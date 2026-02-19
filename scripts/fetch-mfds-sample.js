/**
 * 식약처 API(DrugPrdtPrmsnInfoService07)에서 100건 조회 → mfds_sample_data.csv 저장
 * 설정: pageNo=1, numOfRows=100, type=json
 * 환경변수: .env.local 의 MFDS_DRUG_INFO_API_KEY 사용
 * 필드: PRDUCT(제품명), MTRAL_NM(성분명), ENTRPS(업체명)
 *
 * 실행 방법 (프로젝트 루트에서):
 *   node scripts/fetch-mfds-sample.js
 * 결과 파일: 프로젝트 루트의 mfds_sample_data.csv (UTF-8 BOM)
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// .env.local 로드 (프로젝트 루트 기준)
dotenv.config({ path: path.join(root, '.env.local') })

const BASE =
  'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtMcpnDtlInq07'

function pick(row, ...keys) {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/** response.body.items.item 또는 response.body.items 중 실제 배열 추출 (둘 다 지원) */
function normalizeItems(body) {
  const byItem = body?.items?.item
  if (byItem != null) return Array.isArray(byItem) ? byItem : [byItem]
  const raw = body?.items
  if (raw == null) return []
  return Array.isArray(raw) ? raw : [raw]
}

function escapeCsvCell(s) {
  if (s == null) return ''
  const str = String(s)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

async function fetchPage(apiKey, params, pageNo = 1, numOfRows = 100) {
  const parts = [
    `serviceKey=${apiKey}`,
    `pageNo=${pageNo}`,
    `numOfRows=${numOfRows}`,
  ]
  if (params.Prduct) parts.splice(1, 0, `Prduct=${encodeURIComponent(params.Prduct)}`)
  if (params.MTRAL_NM) parts.splice(1, 0, `MTRAL_NM=${encodeURIComponent(params.MTRAL_NM)}`)
  const url = `${BASE}?${parts.join('&')}&type=json`
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text)
  console.log('API 데이터 샘플:', JSON.stringify(data).substring(0, 500))
  const header = data?.response?.header ?? data?.header
  const resultCode = header?.resultCode
  if (resultCode !== '00' && resultCode !== undefined) {
    const msg = header?.resultMsg ?? text.slice(0, 200)
    throw new Error(`API ${resultCode}: ${msg}`)
  }
  const body = data?.response?.body ?? data?.body ?? {}
  const totalCount = Number(body?.totalCount ?? 0)
  const rows = normalizeItems(body)
  return { rows, totalCount }
}

async function main() {
  const apiKey = process.env.MFDS_DRUG_INFO_API_KEY?.trim()
  if (!apiKey) {
    console.error('❌ .env.local에 MFDS_DRUG_INFO_API_KEY가 없습니다.')
    process.exit(1)
  }

  console.log('🌐 식약처 API 호출 중 (pageNo=1, numOfRows=100, type=json)...')
  let rows = []
  let totalCount = 0

  // 넓은 조건으로 100건 요청 (Prduct=% → 파라미터 없음 → 공통 검색어 '정' 순으로 시도)
  const attempts = [
    { Prduct: '%' },
    {},
    { Prduct: '타이레놀' },
  ]
  for (const params of attempts) {
    try {
      const res = await fetchPage(apiKey, params, 1, 100)
      rows = res.rows
      totalCount = res.totalCount
      if (rows.length > 0) break
    } catch (e) {
      continue
    }
  }
  if (rows.length === 0) {
    try {
      const res = await fetchPage(apiKey, { MTRAL_NM: '아세트아미노펜' }, 1, 100)
      rows = res.rows
      totalCount = res.totalCount
    } catch (_) {}
  }

  if (rows.length === 0) {
    console.warn('⚠️ 조회 결과 0건입니다. API가 검색 조건(Prduct 등)을 요구할 수 있습니다.')
  } else {
    console.log(`✅ ${rows.length}건 수신 (totalCount: ${totalCount})`)
  }

  const csvHeader = 'PRDUCT,MTRAL_NM,ENTRPS'
  const csvRows = rows.map((r) => {
    const prduct = escapeCsvCell(pick(r, 'PRDUCT', 'prduct'))
    const mtralNm = escapeCsvCell(pick(r, 'MTRAL_NM', 'mtral_nm'))
    const entrps = escapeCsvCell(pick(r, 'ENTRPS', 'entrps'))
    return `${prduct},${mtralNm},${entrps}`
  })
  const csv = [csvHeader, ...csvRows].join('\n')

  const outPath = path.join(root, 'mfds_sample_data.csv')
  try {
    fs.writeFileSync(outPath, '\uFEFF' + csv, 'utf8')
    console.log(`📁 저장 완료: ${outPath}`)
  } catch (writeErr) {
    const fallback = path.join(__dirname, 'mfds_sample_data.csv')
    fs.writeFileSync(fallback, '\uFEFF' + csv, 'utf8')
    console.log(`📁 저장 완료 (루트 쓰기 불가로 대체): ${fallback}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
