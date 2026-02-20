/**
 * 의약품 RAG 파이프라인 — 하이브리드 검색
 *
 * 1) Supabase drug_master 우선: product_name ILIKE '%검색어%' (pg_trgm 인덱스 활용)
 * 2) API 폴백: DB 결과 0건일 때만 식약처 getDrugPrdtMcpnDtlInq07 호출 후 drug_master Insert
 *
 * 검색 결과 매핑: prduct → productName, mtral_nm → ingredientName (DB/API 동일 포맷으로 AI 전달)
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

/** API/캐시 항목 → 성분 분석 섹션용 텍스트. 다중 결과도 모두 전달(LLM이 선택·요약) */
export function formatDrugContextForPrompt(items: MfdsMcpn07Item[], maxItems = 20): string {
  const lines: string[] = []
  for (const item of items.slice(0, maxItems)) {
    lines.push(`■ 제품명: ${item.productName || '(정보 없음)'}`)
    if (item.ingredientName) lines.push(`  성분명: ${clip(item.ingredientName, 300)}`)
    if (item.companyName) lines.push(`  업체명: ${item.companyName}`)
    if (item.eeDocData) lines.push(`  효능: ${clip(item.eeDocData, 500)}`)
    if (item.nbDocData) lines.push(`  주의사항: ${clip(item.nbDocData, 500)}`)
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

/** drug_master에 API 결과 핵심 필드만 Insert (PRDUCT, MTRAL_NM, ENTRPS, EE_DOC_DATA, NB_DOC_DATA) */
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
  let { error } = await supabase.from('drug_master').insert(payload)
  if (error) {
    const fallback = items.map((r) => ({
      product_name: r.productName,
      main_ingredient: r.ingredientName || null,
      ingredient_code: null,
    }))
    const r2 = await supabase.from('drug_master').insert(fallback)
    if (!r2.error) return { saved: fallback.length }
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

/**
 * 의약품 RAG 실행: 하이브리드 검색 (DB 우선 → 0건일 때만 API 폴백)
 */
export async function runDrugRag(
  requestId: string,
  drugQuery: string,
  supabaseAdmin: SupabaseAdmin
): Promise<DrugRagResult> {
  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()

  try {
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

    const insertResult = await saveDrugMasterFromApiItems(supabaseAdmin, items)
    if (insertResult.saved > 0) {
      console.log(`📥 [${requestId}] drug_master 자동 캐싱: ${insertResult.saved}건`)
    }
    if (insertResult.error) {
      console.warn(`⚠️ [${requestId}] drug_master Insert 실패(무시):`, insertResult.error)
    }

    const drugContext = formatDrugContextForPrompt(items)
    return { drugContext, apiUsed: true, itemCount: items.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`❌ [${requestId}] MFDS API 호출 실패:`, msg)
    return { drugContext: null, apiUsed: false, itemCount: 0 }
  }
}
