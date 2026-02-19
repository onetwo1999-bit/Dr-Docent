/**
 * 식약처 의약품 개요정보(e약은요) API
 * .env.local의 MFDS_DRUG_INFO_API_KEY 사용.
 * 제품명 검색 → 성공 시 drugs 테이블에 자동 저장.
 */

const MFDS_BASE =
  'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList'

export type MfdsDrugItem = {
  itemSeq: string
  productName: string
  companyName: string
  efficacy: string | null
  useMethod: string | null
  precautionsWarn: string | null
  precautions: string | null
  interaction: string | null
  sideEffect: string | null
  storageMethod: string | null
  itemImage: string | null
  ingredients: string | null
  openDe: string | null
  updateDe: string | null
}

type ApiRow = {
  itemSeq?: string
  itemName?: string
  entpName?: string
  efcyQesitm?: string
  useMethodQesitm?: string
  atpnWarnQesitm?: string
  atpnQesitm?: string
  intrcQesitm?: string
  seQesitm?: string
  depositMethodQesitm?: string
  itemImage?: string
  openDe?: string
  updateDe?: string
}

function toMfdsDrugItem(row: ApiRow): MfdsDrugItem {
  return {
    itemSeq: row.itemSeq ?? '',
    productName: row.itemName ?? '',
    companyName: row.entpName ?? '',
    efficacy: row.efcyQesitm ?? null,
    useMethod: row.useMethodQesitm ?? null,
    precautionsWarn: row.atpnWarnQesitm ?? null,
    precautions: row.atpnQesitm ?? null,
    interaction: row.intrcQesitm ?? null,
    sideEffect: row.seQesitm ?? null,
    storageMethod: row.depositMethodQesitm ?? null,
    itemImage: row.itemImage ?? null,
    ingredients: null,
    openDe: row.openDe ?? null,
    updateDe: row.updateDe ?? null,
  }
}

function normalizeItems(body: { items?: ApiRow | ApiRow[] }): ApiRow[] {
  const raw = body?.items
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

/**
 * 제품명으로 e약은요 API 조회. 성공 시 items 반환.
 */
export async function fetchDrugListByProductName(
  apiKey: string,
  itemName: string,
  options?: { pageNo?: number; numOfRows?: number }
): Promise<{ items: MfdsDrugItem[]; totalCount: number }> {
  const key = apiKey?.trim()
  if (!key) throw new Error('MFDS_DRUG_INFO_API_KEY is required')
  const name = itemName?.trim()
  if (!name) throw new Error('itemName is required')

  const params = new URLSearchParams({
    serviceKey: key,
    pageNo: String(options?.pageNo ?? 1),
    numOfRows: String(options?.numOfRows ?? 10),
    itemName: name,
    type: 'json',
  })
  const url = `${MFDS_BASE}?${params.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`MFDS API HTTP ${res.status}: ${text.slice(0, 200)}`)

  let data: {
    response?: {
      header?: { resultCode?: string; resultMsg?: string }
      body?: { totalCount?: number; items?: ApiRow | ApiRow[] }
    }
  }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`MFDS API invalid JSON: ${text.slice(0, 200)}`)
  }

  const resultCode = data?.response?.header?.resultCode
  if (resultCode !== '00' && resultCode !== undefined) {
    const msg = data?.response?.header?.resultMsg ?? text.slice(0, 200)
    throw new Error(`MFDS API error: ${resultCode} - ${msg}`)
  }

  const totalCount = Number(data?.response?.body?.totalCount ?? 0)
  const rows = normalizeItems(data?.response?.body ?? {})
  const items = rows.map(toMfdsDrugItem).filter((i) => i.itemSeq)
  return { items, totalCount }
}

/**
 * drugs 테이블에 upsert (item_seq 기준). 서버 전용이므로 createAdminClient() 사용.
 */
export async function saveDrugsToDb(
  supabase: { from: (table: string) => { upsert: (payload: unknown[], opts?: { onConflict?: string }) => Promise<{ error: unknown }> } },
  items: MfdsDrugItem[]
): Promise<{ saved: number; error?: string }> {
  if (!items.length) return { saved: 0 }
  const rows = items.map((i) => ({
    item_seq: i.itemSeq,
    product_name: i.productName || null,
    company_name: i.companyName || null,
    efficacy: i.efficacy || null,
    use_method: i.useMethod || null,
    precautions_warn: i.precautionsWarn || null,
    precautions: i.precautions || null,
    interaction: i.interaction || null,
    side_effect: i.sideEffect || null,
    storage_method: i.storageMethod || null,
    item_image: i.itemImage || null,
    ingredients: i.ingredients || null,
    open_de: i.openDe || null,
    update_de: i.updateDe || null,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('drugs').upsert(rows, { onConflict: 'item_seq' })
  if (error) return { saved: 0, error: String(error) }
  return { saved: rows.length }
}

/**
 * 제품명 검색 후 성공 시 DB에 자동 저장. API 키는 process.env.MFDS_DRUG_INFO_API_KEY 사용.
 */
export async function searchDrugByProductNameAndSave(
  itemName: string,
  supabaseAdmin: ReturnType<typeof import('@/utils/supabase/admin').createAdminClient>
): Promise<{ items: MfdsDrugItem[]; totalCount: number; saved: number; error?: string }> {
  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('MFDS_DRUG_INFO_API_KEY is required in .env.local')
  }
  const { items, totalCount } = await fetchDrugListByProductName(apiKey, itemName, {
    pageNo: 1,
    numOfRows: 20,
  })
  let saved = 0
  let saveError: string | undefined
  if (items.length > 0) {
    const result = await saveDrugsToDb(supabaseAdmin, items)
    saved = result.saved
    saveError = result.error
  }
  return { items, totalCount, saved, error: saveError }
}
