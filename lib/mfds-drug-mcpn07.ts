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

/** 제품명 → 성분명 매핑 (PRDUCT 검색 0건일 때 MTRAL_NM 보조 검색용) */
const PRODUCT_TO_INGREDIENT: Record<string, string> = {
  타이레놀: '아세트아미노펜',
  페북트: '페북소스타트',
  페북스타트: '페북소스타트',
  콜킨: '콜치친',
  울로릭: '페북소스타트',
  자일로릭: '알로푸리놀',
}

function buildQuery(
  key: string,
  params: { Prduct?: string; MTRAL_NM?: string },
  pageNo: string,
  numOfRows: string
): string {
  const parts: string[] = []
  parts.push(`serviceKey=${key}`)
  if (params.Prduct) parts.push(`Prduct=${encodeURIComponent(params.Prduct)}`)
  if (params.MTRAL_NM) parts.push(`MTRAL_NM=${encodeURIComponent(params.MTRAL_NM)}`)
  parts.push(`pageNo=${pageNo}`, `numOfRows=${numOfRows}`)
  return parts.join('&')
}

function parseResponse(text: string): { items: MfdsMcpn07Item[]; totalCount: number } {
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

async function request(apiKey: string, params: { Prduct?: string; MTRAL_NM?: string }, options: { pageNo: number; numOfRows: number }) {
  const pageNo = String(options.pageNo)
  const numOfRows = String(options.numOfRows)
  const q = buildQuery(apiKey, params, pageNo, numOfRows)
  // 응답을 JSON으로 수신하기 위해 URL 끝에 &type=json 고정
  const url = `${MFDS_MCPN07_BASE}?${q}&type=json`
  const maskedUrl = url.replace(/serviceKey=[^&]+/, `serviceKey=${apiKey.length >= 4 ? apiKey.slice(0, 4) : ''}...`)
  console.log('[MFDS MCPN07]', maskedUrl)
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`MFDS MCPN07 API HTTP ${res.status}: ${text.slice(0, 200)}`)
  return parseResponse(text)
}

/**
 * 제품명 검색 → getDrugPrdtMcpnDtlInq07 호출 (JSON, serviceKey 그대로).
 * 파라미터: Prduct(제품명, 대소문자 고정). 0건이면 MTRAL_NM(성분명) 보조 검색.
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

  const opts = { pageNo: options?.pageNo ?? 1, numOfRows: options?.numOfRows ?? 10 }

  // 1) Prduct(제품명, 대소문자 고정)로 검색. 한글은 encodeURIComponent 적용
  let result = await request(key, { Prduct: name }, opts)
  if (result.items.length > 0) return result

  // 2) 부분 일치 시도: Prduct에 검색어% (와일드카드)
  result = await request(key, { Prduct: `${name}%` }, opts)
  if (result.items.length > 0) return result

  // 3) 보조: 성분명(MTRAL_NM)으로 검색 (알려진 제품명→성분 매핑)
  const ingredient = PRODUCT_TO_INGREDIENT[name] ?? name
  result = await request(key, { MTRAL_NM: ingredient }, opts)
  if (result.items.length > 0) return result

  // 4) 성분명 부분 일치
  result = await request(key, { MTRAL_NM: `${ingredient}%` }, opts)
  return result
}
