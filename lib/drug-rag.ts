/**
 * 의약품 RAG 파이프라인 — 학습형 하이브리드 검색
 *
 * 1) search_logs에 해당 키워드 call_count 1 증가 (RPC: increment_search_log)
 * 2) drug_master 우선 검색 (product_name ILIKE '%검색어%')
 * 3) 0건일 때만 식약처 API 호출
 * 4) 인기 키워드(call_count >= 5)면 API 결과를 drug_master에 영구 저장(캐싱)
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

/**
 * drug_master 캐시 조회: pg_trgm 인덱스 활용을 위한 ILIKE 검색 (제품명).
 * - 패턴: %검색어% (Supabase .ilike → PostgreSQL ilike, trigram GIN 인덱스 사용)
 * - 결과: prduct(product_name), mtral_nm(main_ingredient) 등 핵심 필드만
 */
async function getCachedDrugRows(
  supabase: SupabaseAdmin,
  query: string,
  limit = 20
): Promise<DrugMasterRow[]> {
  const q = query?.trim()
  if (!q) return []
  const pattern = `%${q}%`
  try {
    const { data, error } = await supabase
      .from('drug_master')
      .select('product_name, main_ingredient, company_name, ee_doc_data, nb_doc_data')
      .ilike('product_name', pattern)
      .order('product_name', { ascending: true })
      .limit(limit)
    if (error || !Array.isArray(data)) return []
    return data as DrugMasterRow[]
  } catch {
    return []
  }
}

export type DrugRagResult = {
  drugContext: string | null
  apiUsed: boolean
  itemCount: number
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

/**
 * 의약품 RAG 실행: 학습형 하이브리드 (검색 로그 → DB 우선 → 0건 시 API → 인기 키워드 시 영구 캐싱)
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
    if (cached.length > 0) {
      const items = cacheRowsToItems(cached)
      const drugContext = formatDrugContextForPrompt(items)
      console.log(`💊 [${requestId}] drug_master 캐시 사용: ${cached.length}건 (API 미호출)`)
      return { drugContext, apiUsed: false, itemCount: cached.length }
    }

    if (!apiKey) {
      console.warn(`⚠️ [${requestId}] MFDS_DRUG_INFO_API_KEY 미설정 — API 폴백 불가`)
      return { drugContext: null, apiUsed: false, itemCount: 0 }
    }

    console.log(`🌐 [${requestId}] DB 0건 → 식약처 API 폴백 (getDrugPrdtMcpnDtlInq07): "${drugQuery}"`)
    const { items, totalCount } = await fetchDrugPrdtMcpnDtlInq07(apiKey, drugQuery, {
      pageNo: 1,
      numOfRows: 20,
    })
    console.log(`💊 [${requestId}] MFDS API 반환: ${items.length}건 (totalCount: ${totalCount})`)

    if (items.length === 0) {
      return { drugContext: null, apiUsed: true, itemCount: 0 }
    }

    const isPopular = callCount >= 5
    if (isPopular) {
      const insertResult = await saveDrugMasterFromApiItems(supabaseAdmin, items)
      if (insertResult.saved > 0) {
        console.log(`📥 [${requestId}] 인기 키워드(call_count=${callCount}) → drug_master 영구 캐싱: ${insertResult.saved}건`)
      }
      if (insertResult.error) {
        console.warn(`⚠️ [${requestId}] drug_master 저장 실패(무시):`, insertResult.error)
      }
    } else {
      console.log(`📋 [${requestId}] call_count ${callCount} < 5 → API 결과만 반환, DB 미저장`)
    }

    const drugContext = formatDrugContextForPrompt(items)
    return { drugContext, apiUsed: true, itemCount: items.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ [${requestId}] MFDS API 호출 실패:`, msg)
    return { drugContext: null, apiUsed: false, itemCount: 0 }
  }
}
