/**
 * 식약처 API에서 상위 1,000건 조회 → mfds_sample_data.csv (Supabase drug_master 업로드용)
 * CSV 컬럼: product_name, main_ingredient, company_name, ee_doc_data, nb_doc_data
 * 업로드 전: Supabase SQL Editor에서 supabase/drug_master-add-columns.sql 실행 필요.
 *
 * 실행: node scripts/fetch-mfds-sample.js
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

async function fetchPage(apiKey, params, pageNo = 1, numOfRows = 1000) {
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
  const apiKey = process.env.MFDS_SERVICE_KEY?.trim()
  if (!apiKey) {
    console.error('❌ .env.local에 MFDS_SERVICE_KEY(e-약은요)가 없습니다.')
    process.exit(1)
  }

  // 공공 API는 한 번에 1000건을 주지 않을 수 있음 → 100건씩 10페이지 요청해 1,000건 수집
  const PAGE_SIZE = 100
  const TARGET = 1000
  const PAGES = Math.ceil(TARGET / PAGE_SIZE)
  console.log(`🌐 식약처 API 호출 중 (상위 ${TARGET}건 = ${PAGES}페이지 × ${PAGE_SIZE}건)...`)

  let rows = []
  let totalCount = 0
  let lastTotal = 0

  try {
    for (let page = 1; page <= PAGES; page++) {
      const res = await fetchPage(apiKey, {}, page, PAGE_SIZE)
      if (page === 1) {
        console.log('API 데이터 샘플:', JSON.stringify(res.rows[0] ?? {}).substring(0, 300))
        totalCount = res.totalCount
      }
      if (res.rows.length === 0) break
      rows = rows.concat(res.rows)
      lastTotal = res.rows.length
      if (res.rows.length < PAGE_SIZE) break
    }
  } catch (e) {
    console.error('❌ API 호출 실패:', e.message)
    process.exit(1)
  }

  if (rows.length === 0) {
    console.warn('⚠️ 조회 결과 0건입니다. API 키·URL·응답 구조를 확인하세요.')
  } else {
    console.log(`✅ ${rows.length}건 수신 (totalCount: ${totalCount})`)
  }

  // Supabase drug_master 테이블 컬럼명과 일치 (PRDUCT→product_name, MTRAL_NM→main_ingredient 등)
  const csvHeader = 'product_name,main_ingredient,company_name,ee_doc_data,nb_doc_data'
  const csvRows = rows.map((r) => {
    const productName = escapeCsvCell(pick(r, 'PRDUCT', 'prduct'))
    const mainIngredient = escapeCsvCell(pick(r, 'MTRAL_NM', 'mtral_nm'))
    const companyName = escapeCsvCell(pick(r, 'ENTRPS', 'entrps'))
    const eeDoc = escapeCsvCell(pick(r, 'EE_DOC_DATA', 'ee_doc_data'))
    const nbDoc = escapeCsvCell(pick(r, 'NB_DOC_DATA', 'nb_doc_data'))
    return `${productName},${mainIngredient},${companyName},${eeDoc},${nbDoc}`
  })
  const csv = [csvHeader, ...csvRows].join('\n')

  const outPath = path.join(root, 'mfds_sample_data.csv')
  try {
    fs.writeFileSync(outPath, '\uFEFF' + csv, 'utf8')
    console.log(`📁 저장 완료: ${outPath} (Supabase drug_master 컬럼명 적용)`)
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
