/**
 * 식약처 의약품 제품·성분 상세 API (DrugPrdtPrmsnInfoService07 / getDrugPrdtMcpnDtlInq07)
 * - 엔드포인트: https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtMcpnDtlInq07
 * - JSON 응답: URL 끝에 &type=json
 * - serviceKey: encodeURIComponent 사용하지 않고 값 그대로 전달
 * - 표시 필드: PRDUCT(제품명), MTRAL_NM(성분명), ENTRPS(업체명)
 */

const MFDS_MCPN07_BASE =
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtMcpnDtlInq07'

export type MfdsMcpn07Item = {
  productName: string   // PRDUCT
  ingredientName: string // MTRAL_NM
  companyName: string   // ENTRPS
}

type ApiRow = {
  PRDUCT?: string
  MTRAL_NM?: string
  ENTRPS?: string
  prduct?: string
  mtral_nm?: string
  entrps?: string
  [key: string]: string | undefined
}

function pick(obj: ApiRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function normalizeItems(body: { items?: ApiRow | ApiRow[] }): ApiRow[] {
  const raw = body?.items
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

/**
 * 제품명 검색 → getDrugPrdtMcpnDtlInq07 호출 (JSON, serviceKey 그대로)
 */
export async function fetchDrugPrdtMcpnDtlInq07(
  apiKey: string,
  itemName: string,
  options?: { pageNo?: number; numOfRows?: number }
): Promise<{ items: MfdsMcpn07Item[]; totalCount: number }> {
  const key = apiKey?.trim()
  if (!key) throw new Error('MFDS_DRUG_INFO_API_KEY is required')
  const name = itemName?.trim()
  if (!name) throw new Error('itemName is required')

  const pageNo = String(options?.pageNo ?? 1)
  const numOfRows = String(options?.numOfRows ?? 10)
  // serviceKey: 인코딩 없이 환경 변수 값 그대로. URL 끝에 &type=json 고정으로 JSON 수신
  const q = `serviceKey=${key}&itemName=${encodeURIComponent(name)}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`
  const url = `${MFDS_MCPN07_BASE}?${q}`

  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`MFDS MCPN07 API HTTP ${res.status}: ${text.slice(0, 200)}`)

  let data: {
    response?: {
      header?: { resultCode?: string; resultMsg?: string }
      body?: { totalCount?: number; items?: ApiRow | ApiRow[] }
    }
  }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`MFDS MCPN07 API invalid JSON: ${text.slice(0, 200)}`)
  }

  const resultCode = data?.response?.header?.resultCode
  if (resultCode !== '00' && resultCode !== undefined) {
    const msg = data?.response?.header?.resultMsg ?? text.slice(0, 200)
    throw new Error(`MFDS MCPN07 API error: ${resultCode} - ${msg}`)
  }

  const totalCount = Number(data?.response?.body?.totalCount ?? 0)
  const rows = normalizeItems(data?.response?.body ?? {})
  const items: MfdsMcpn07Item[] = rows.map((r) => ({
    productName: pick(r, 'PRDUCT', 'prduct'),
    ingredientName: pick(r, 'MTRAL_NM', 'mtral_nm'),
    companyName: pick(r, 'ENTRPS', 'entrps'),
  }))
  return { items, totalCount }
}
