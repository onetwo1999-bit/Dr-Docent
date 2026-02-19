/**
 * 식약처 의약품 주성분 API (getDrugPrdtMcpnDtlInq07)
 * .env.local의 MFDS_DRUG_INFO_API_KEY 사용.
 * 제품명 검색 → drug_master 캐시 조회 → 없으면 API 호출 후 DB 저장.
 */

import { fetchDrugListByProductName } from './mfds-drug-api'

const MFDS_MCPN_BASE =
  'https://apis.data.go.kr/1471000/DrugPrdtMcpnDtlInq07Service/getDrugPrdtMcpnDtlInq07'

export type DrugMasterRow = {
  id: string
  product_name: string
  main_ingredient: string | null
  ingredient_code: string | null
  created_at?: string
  updated_at?: string
}

type McpnApiRow = {
  itemSeq?: string
  itemName?: string
  mainIngrNm?: string
  efctvIngrNm?: string
  ingrCode?: string
  gnlNmCd?: string
  [key: string]: string | undefined
}

function normalizeMcpnItems(body: { items?: McpnApiRow | McpnApiRow[] }): McpnApiRow[] {
  const raw = body?.items
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

/**
 * 주성분 상세 API 호출 (품목기준코드 기준). 유효성분명 추출.
 */
export async function fetchDrugPrdtMcpnDtlInq07(
  apiKey: string,
  itemSeq: string,
  options?: { pageNo?: number; numOfRows?: number }
): Promise<{ productName: string; mainIngredient: string | null; ingredientCode: string | null }[]> {
  const key = apiKey?.trim()
  if (!key) throw new Error('MFDS_DRUG_INFO_API_KEY is required')
  const seq = itemSeq?.trim()
  if (!seq) throw new Error('itemSeq is required')

  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: String(options?.pageNo ?? 1),
    numOfRows: String(options?.numOfRows ?? 20),
    itemSeq: seq,
    type: 'json',
  })
  const url = `${MFDS_MCPN_BASE}?${params.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`MFDS 주성분 API HTTP ${res.status}: ${text.slice(0, 200)}`)

  let data: {
    response?: {
      header?: { resultCode?: string; resultMsg?: string }
      body?: { totalCount?: number; items?: McpnApiRow | McpnApiRow[] }
    }
  }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`MFDS 주성분 API invalid JSON: ${text.slice(0, 200)}`)
  }

  const resultCode = data?.response?.header?.resultCode
  if (resultCode !== '00' && resultCode !== undefined) {
    const msg = data?.response?.header?.resultMsg ?? text.slice(0, 200)
    throw new Error(`MFDS 주성분 API error: ${resultCode} - ${msg}`)
  }

  const rows = normalizeMcpnItems(data?.response?.body ?? {})
  return rows.map((r) => ({
    productName: r.itemName ?? '',
    mainIngredient:
      r.mainIngrNm ?? r.efctvIngrNm ?? (r as McpnApiRow).유효성분명 ?? null,
    ingredientCode: r.ingrCode ?? r.gnlNmCd ?? (r as McpnApiRow).성분코드 ?? null,
  }))
}

type SupabaseAdmin = ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>

/**
 * drug_master에 캐시 저장. (product_name UNIQUE 없음 → insert만 사용)
 */
async function insertDrugMaster(
  supabase: SupabaseAdmin,
  rows: { productName: string; mainIngredient: string | null; ingredientCode: string | null }[]
): Promise<{ saved: number; error?: string }> {
  if (!rows.length) return { saved: 0 }
  const payload = rows.map((r) => ({
    product_name: r.productName,
    main_ingredient: r.mainIngredient ?? null,
    ingredient_code: r.ingredientCode ?? null,
  }))
  const { error } = await supabase.from('drug_master').insert(payload)
  if (error) return { saved: 0, error: String(error) }
  return { saved: payload.length }
}

/**
 * 제품명으로 유효성분 정보 조회. 1) drug_master 캐시 조회 → 2) 없으면 e약은요로 itemSeq 조회 후 주성분 API 호출 → DB 저장 후 반환.
 */
export async function getDrugMasterByProductName(
  productName: string,
  supabaseAdmin: SupabaseAdmin
): Promise<{ rows: DrugMasterRow[]; fromCache: boolean; saved?: number }> {
  const name = productName?.trim()
  if (!name) return { rows: [], fromCache: true }

  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()
  if (!apiKey) throw new Error('MFDS_DRUG_INFO_API_KEY is required in .env.local')

  const pattern = `%${name}%`
  const { data: cached, error: selectError } = await supabaseAdmin
    .from('drug_master')
    .select('id, product_name, main_ingredient, ingredient_code, created_at, updated_at')
    .ilike('product_name', pattern)
    .limit(20)

  if (!selectError && cached && Array.isArray(cached) && cached.length > 0) {
    return { rows: cached as DrugMasterRow[], fromCache: true }
  }

  const easyList = await fetchDrugListByProductName(apiKey, name, {
    pageNo: 1,
    numOfRows: 5,
  })
  if (!easyList.items.length) return { rows: [], fromCache: false }

  const results: DrugMasterRow[] = []
  const toInsert: { productName: string; mainIngredient: string | null; ingredientCode: string | null }[] = []

  for (const item of easyList.items) {
    try {
      const mcpnList = await fetchDrugPrdtMcpnDtlInq07(apiKey, item.itemSeq, {
        pageNo: 1,
        numOfRows: 10,
      })
      for (const m of mcpnList) {
        const productNameVal = m.productName || item.productName
        const mainIngredient = m.mainIngredient ?? null
        const ingredientCode = m.ingredientCode ?? null
        toInsert.push({
          productName: productNameVal,
          mainIngredient,
          ingredientCode,
        })
        results.push({
          id: '',
          product_name: productNameVal,
          main_ingredient: mainIngredient,
          ingredient_code: ingredientCode,
        })
      }
    } catch (err) {
      const fallback = {
        productName: item.productName,
        mainIngredient: null,
        ingredientCode: null,
      }
      toInsert.push(fallback)
      results.push({
        id: '',
        product_name: item.productName,
        main_ingredient: null,
        ingredient_code: null,
      })
    }
  }

  let saved = 0
  if (toInsert.length > 0) {
    const insertResult = await insertDrugMaster(supabaseAdmin, toInsert)
    saved = insertResult.saved
  }

  return { rows: results, fromCache: false, saved }
}
