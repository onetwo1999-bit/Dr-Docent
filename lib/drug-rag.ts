/**
 * 의약품 RAG — 실시간 API 호출 및 지능형 캐싱
 *
 * 1) search_logs에 해당 키워드 call_count 1 증가 (RPC: increment_search_log)
 * 2) drug_master 우선 검색 (product_name ILIKE '%검색어%')
 * 3) DB 0건 또는 효능(ee_doc_data) 비어 있으면 즉시 e-약은요 API 폴백 → 프롬프트에 주입(할루시네이션 방지)
 * 4) 답변 후 비동기 saveDrugResultAfterResponse: API 결과는 무조건 upsert, paper_insight는 5회 이상만 저장
 */

import { fetchDrugPrdtMcpnDtlInq07, type MfdsMcpn07Item } from './mfds-drug-mcpn07'

type SupabaseAdmin = ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>

/** drug_master 한 행 (캐시) → MfdsMcpn07Item 형태로 변환 */
type DrugMasterRow = {
  product_name: string
  main_ingredient: string | null
  company_name?: string | null
  ee_doc_data?: string | null
  nb_doc_data?: string | null
}

/** 길이 제한 헬퍼 */
function clip(s: string | null | undefined, max: number): string | null {
  if (!s) return null
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** API/캐시 항목 → LLM 컨텍스트용 텍스트. 제품명·성분명·효능·주의사항 포함(행동 지침 생성에 사용) */
export function formatDrugContextForPrompt(items: MfdsMcpn07Item[], maxItems = 20): string {
  const lines: string[] = []
  for (const item of items.slice(0, maxItems)) {
    lines.push(`■ 제품명: ${item.productName || '(정보 없음)'}`)
    if (item.ingredientName) lines.push(`  성분명: ${clip(item.ingredientName, 300)}`)
    if (item.companyName) lines.push(`  업체명: ${item.companyName}`)
    if (item.eeDocData) lines.push(`  효능: ${clip(item.eeDocData, 600)}`)
    if (item.nbDocData) lines.push(`  주의사항: ${clip(item.nbDocData, 600)}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}

function cacheRowsToItems(rows: DrugMasterRow[]): MfdsMcpn07Item[] {
  return rows.map((r) => ({
    productName: r.product_name ?? '',
    ingredientName: r.main_ingredient ?? '',
    companyName: r.company_name ?? '',
    eeDocData: r.ee_doc_data ?? null,
    nbDocData: r.nb_doc_data ?? null,
  }))
}

/**
 * API에서 가져온 제품명·성분명·효능·주의사항을 drug_master에 즉시 Upsert.
 * 동일 product_name이 있으면 ee_doc_data, nb_doc_data 포함 해당 행 갱신.
 */
async function saveDrugMasterFromApiItems(
  supabase: SupabaseAdmin,
  items: MfdsMcpn07Item[]
): Promise<{ saved: number; error?: string }> {
  if (!items.length) return { saved: 0 }
  const payload = items.map((r) => ({
    product_name: r.productName,
    main_ingredient: r.ingredientName || null,
    ingredient_code: null,
    company_name: r.companyName || null,
    ee_doc_data: r.eeDocData ?? null,
    nb_doc_data: r.nbDocData ?? null,
  }))
  const { error } = await supabase.from('drug_master').upsert(payload, {
    onConflict: 'product_name',
    ignoreDuplicates: false,
  })
  if (error) {
    const { error: insertError } = await supabase.from('drug_master').insert(payload)
    if (!insertError) return { saved: payload.length }
    return { saved: 0, error: String(error) }
  }
  return { saved: payload.length }
}

/** LIKE/ILIKE 와일드카드(% _) 이스케이프: 검색어에 포함된 % _ 를 리터럴로 매칭 */
function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * drug_master 캐시 조회: 부분 검색(ILIKE %검색어%). pg_trgm 인덱스 활용.
 * - eq(완전 일치) 사용 안 함. 검색어 앞뒤에 % 붙여 부분 일치.
 */
async function getCachedDrugRows(
  supabase: SupabaseAdmin,
  query: string,
  limit = 20
): Promise<DrugMasterRow[]> {
  const q = query?.trim()
  if (!q) return []
  const pattern = `%${escapeLikePattern(q)}%`
  try {
    // product_name 컬럼과 유저 검색어를 ILIKE로 부분 매칭 (%검색어%, 대소문자 무시)
    const { data, error } = await supabase
      .from('drug_master')
      .select('product_name, main_ingredient, company_name, ee_doc_data, nb_doc_data')
      .ilike('product_name', pattern)
      .order('product_name', { ascending: true })
      .limit(limit)
    if (error) {
      console.warn('[drug_master] 쿼리 오류:', error.message, '| keyword:', q)
      return []
    }
    const rows = Array.isArray(data) ? (data as DrugMasterRow[]) : []
    console.log(`[drug_master] 키워드 "${q}" 조회 로우 수: ${rows.length}건`)
    return rows
  } catch (e) {
    console.warn('[drug_master] 조회 예외:', e instanceof Error ? e.message : String(e))
    return []
  }
}

export type DrugRagResult = {
  drugContext: string | null
  apiUsed: boolean
  itemCount: number
  /** MTRAL_NM(성분명) 추출 → 논문 RAG queryPapers 키워드로 사용 */
  paperSearchKeywords: string[]
  /** 인기 키워드(5회 이상) 시 paper_insight 업데이트 대상 제품명 목록 */
  productNamesForCache: string[]
  callCount: number
  /** API 호출로 가져온 항목(답변 후 비동기 저장용). apiUsed일 때만 존재 */
  apiItems?: MfdsMcpn07Item[]
}

/** search_logs에 검색 키워드 기록 후 현재 call_count 반환 (RPC: increment_search_log) */
async function incrementSearchLog(
  supabase: SupabaseAdmin,
  keyword: string
): Promise<number> {
  const q = keyword?.trim()
  if (!q) return 0
  try {
    const { data, error } = await supabase.rpc('increment_search_log', { p_keyword: q })
    if (error) {
      console.warn('search_logs increment 실패:', error.message)
      return 0
    }
    return typeof data === 'number' ? data : 0
  } catch {
    return 0
  }
}

/** DB/API 결과에서 MTRAL_NM(성분명)만 추출 → 논문 RAG 키워드 */
function extractPaperSearchKeywords(items: MfdsMcpn07Item[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const name = (item.ingredientName ?? '').trim()
    if (name) set.add(name)
  }
  return Array.from(set)
}

const emptyDrugRagResult = (): DrugRagResult => ({
  drugContext: null,
  apiUsed: false,
  itemCount: 0,
  paperSearchKeywords: [],
  productNamesForCache: [],
  callCount: 0,
})

/**
 * 의약품 RAG 실행: 학습형 하이브리드 + 성분명 추출(paperSearchKeywords)
 */
export async function runDrugRag(
  requestId: string,
  drugQuery: string,
  supabaseAdmin: SupabaseAdmin
): Promise<DrugRagResult> {
  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()

  try {
    const callCount = await incrementSearchLog(supabaseAdmin, drugQuery)
    if (callCount > 0) {
      console.log(`📊 [${requestId}] search_logs: "${drugQuery}" call_count=${callCount}`)
    }

    const cached = await getCachedDrugRows(supabaseAdmin, drugQuery, 20)
    const hasEfficacy = cached.length > 0 && cached.some((r) => (r.ee_doc_data ?? '').trim().length > 0)
    console.log(`[drug_master] keyword="${drugQuery}" → ${cached.length}건, 효능 있음: ${hasEfficacy}`)

    if (hasEfficacy) {
      console.log('DB 결과:', JSON.stringify(cached.map((r) => ({ product_name: r.product_name, main_ingredient: r.main_ingredient }))))
      const items = cacheRowsToItems(cached)
      const drugContext = formatDrugContextForPrompt(items)
      const paperSearchKeywords = extractPaperSearchKeywords(items)
      const productNamesForCache = callCount >= 5 ? items.map((i) => i.productName).filter(Boolean) : []
      console.log(`💊 [${requestId}] drug_master 캐시 사용: ${cached.length}건, paperSearchKeywords:`, paperSearchKeywords)
      return {
        drugContext,
        apiUsed: false,
        itemCount: cached.length,
        paperSearchKeywords,
        productNamesForCache,
        callCount,
      }
    }

    if (!apiKey) {
      if (cached.length > 0) {
        console.warn(`⚠️ [${requestId}] DB에 효능(ee_doc_data) 없음 — API 키 없어 폴백 불가`)
      } else {
        console.warn(`⚠️ [${requestId}] MFDS_DRUG_INFO_API_KEY 미설정 — API 폴백 불가`)
      }
      return emptyDrugRagResult()
    }

    if (cached.length > 0) {
      console.log(`🌐 [${requestId}] DB에 효능 없음 → e-약은요 API 폴백: "${drugQuery}"`)
    } else {
      console.log(`🌐 [${requestId}] DB 0건 → 식약처 API 폴백 (getDrugPrdtMcpnDtlInq07): "${drugQuery}"`)
    }
    const { items, totalCount } = await fetchDrugPrdtMcpnDtlInq07(apiKey, drugQuery, {
      pageNo: 1,
      numOfRows: 20,
    })
    console.log(`💊 [${requestId}] MFDS API 반환: ${items.length}건 (totalCount: ${totalCount})`)

    if (items.length === 0) {
      return { ...emptyDrugRagResult(), apiUsed: true }
    }

    // 실시간 캐싱: API 호출 결과는 즉시 DB에 upsert(다음 검색 시 DB 히트). paper_insight는 답변 후 비동기로 5회 이상일 때만 저장.
    const drugContext = formatDrugContextForPrompt(items)
    const paperSearchKeywords = extractPaperSearchKeywords(items)
    const productNamesForCache = callCount >= 5 ? items.map((i) => i.productName).filter(Boolean) : []
    console.log(`📚 [${requestId}] paperSearchKeywords(성분명):`, paperSearchKeywords)
    return {
      drugContext,
      apiUsed: true,
      itemCount: items.length,
      paperSearchKeywords,
      productNamesForCache,
      callCount,
      apiItems: items,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ [${requestId}] MFDS API 호출 실패:`, msg)
    return emptyDrugRagResult()
  }
}

/**
 * 답변 전송 후 비동기로 호출: API 결과를 drug_master에 upsert하고, 5회 이상 검색된 약물에 한해 paper_insight(안심 행동 지침) 업데이트.
 * - apiItems 있으면 무조건 upsert → 다음 검색 시 DB 히트(성능 유리).
 * - paper_insight는 call_count >= 5일 때만 저장(저장 비용·품질 절충).
 */
export async function saveDrugResultAfterResponse(
  supabaseAdmin: SupabaseAdmin,
  opts: {
    apiItems?: MfdsMcpn07Item[]
    productNamesForCache?: string[]
    callCount: number
    guideText?: string | null
    requestId?: string
  }
): Promise<void> {
  const { apiItems, productNamesForCache, callCount, guideText, requestId = '' } = opts
  if (apiItems?.length) {
    const result = await saveDrugMasterFromApiItems(supabaseAdmin, apiItems)
    if (result.saved > 0) {
      console.log(`📥 [${requestId}] 답변 후 drug_master 실시간 캐싱: ${result.saved}건`)
    }
    if (result.error) {
      console.warn(`⚠️ [${requestId}] drug_master upsert 실패:`, result.error)
    }
  }
  if (callCount >= 5 && productNamesForCache?.length && guideText?.trim()) {
    try {
      for (const productName of productNamesForCache.slice(0, 10)) {
        await supabaseAdmin.from('drug_master').update({ paper_insight: guideText.trim() }).eq('product_name', productName)
      }
      console.log(`📥 [${requestId}] paper_insight 캐싱: ${productNamesForCache.length}건 (call_count >= 5)`)
    } catch (e) {
      console.warn(`⚠️ [${requestId}] paper_insight 업데이트 실패:`, e instanceof Error ? e.message : String(e))
    }
  }
}
