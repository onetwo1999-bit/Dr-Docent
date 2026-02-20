/**
 * 실시간 API 호출 및 지능형 캐싱 — 의약품 검색 서비스 (e-약은요 API 단일 통합)
 *
 * - API 키: process.env.MFDS_SERVICE_KEY (e-약은요)
 * - 채팅·검색·성분 조회 모두 getDrugPrdtMcpnDtlInq07(DrugPrdtPrmsnInfoService07)만 사용.
 */

import { fetchDrugPrdtMcpnDtlInq07 } from './mfds-drug-mcpn07'
import { saveDrugMasterFromApiItems } from './drug-rag'

export {
  runDrugRag,
  saveDrugResultAfterResponse,
  saveDrugMasterFromApiItems,
  formatDrugContextForPrompt,
  type DrugRagResult,
} from './drug-rag'
export type { MfdsMcpn07Item } from './mfds-drug-mcpn07'

/** 제품명으로 조회 시 반환 행 (DB 캐시 또는 API 결과) */
export type DrugRow = {
  id?: string
  product_name: string
  main_ingredient: string | null
  ingredient_code?: string | null
  company_name?: string | null
  ee_doc_data?: string | null
  nb_doc_data?: string | null
  created_at?: string
  updated_at?: string
}

/**
 * 제품명으로 유효성분 등 조회. drug_master 캐시 우선 → 없으면 e-약은요 API 호출 후 저장.
 * MFDS_SERVICE_KEY 사용.
 */
export async function getDrugByProductName(
  supabaseAdmin: ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>,
  productName: string
): Promise<{ rows: DrugRow[]; fromCache: boolean; saved?: number }> {
  const name = productName?.trim()
  if (!name) return { rows: [], fromCache: true }

  const pattern = `%${name}%`
  const { data: cached, error } = await supabaseAdmin
    .from('drug_master')
    .select('id, product_name, main_ingredient, ingredient_code, company_name, ee_doc_data, nb_doc_data, created_at, updated_at')
    .ilike('product_name', pattern)
    .order('product_name', { ascending: true })
    .limit(20)

  if (!error && cached && cached.length > 0) {
    return { rows: cached as DrugRow[], fromCache: true }
  }

  const apiKey = process.env.MFDS_SERVICE_KEY?.trim()
  if (!apiKey) throw new Error('MFDS_SERVICE_KEY (e-약은요) is required')

  const { items } = await fetchDrugPrdtMcpnDtlInq07(apiKey, name, { pageNo: 1, numOfRows: 20 })
  if (!items.length) return { rows: [], fromCache: false }

  const { saved } = await saveDrugMasterFromApiItems(supabaseAdmin, items)
  const rows: DrugRow[] = items.map((i) => ({
    product_name: i.productName,
    main_ingredient: i.ingredientName || null,
    company_name: i.companyName ?? null,
    ee_doc_data: i.eeDocData ?? null,
    nb_doc_data: i.nbDocData ?? null,
  }))
  return { rows, fromCache: false, saved }
}

/**
 * 제품명 검색 → e-약은요 API 호출 후 drug_master에 저장. MFDS_SERVICE_KEY 사용.
 */
export async function searchDrugAndSave(
  supabaseAdmin: ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>,
  itemName: string
): Promise<{ items: import('./mfds-drug-mcpn07').MfdsMcpn07Item[]; totalCount: number; saved: number; error?: string }> {
  const name = itemName?.trim()
  if (!name) return { items: [], totalCount: 0, saved: 0 }

  const apiKey = process.env.MFDS_SERVICE_KEY?.trim()
  if (!apiKey) throw new Error('MFDS_SERVICE_KEY (e-약은요) is required')

  const { items, totalCount } = await fetchDrugPrdtMcpnDtlInq07(apiKey, name, { pageNo: 1, numOfRows: 20 })
  let saved = 0
  let error: string | undefined
  if (items.length > 0) {
    const result = await saveDrugMasterFromApiItems(supabaseAdmin, items)
    saved = result.saved
    error = result.error
  }
  return { items, totalCount, saved, error }
}
