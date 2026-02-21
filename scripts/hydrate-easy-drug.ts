/**
 * e-약은요 전체 데이터 추출 → Supabase drug_master 적재
 * - DrbEasyDrugInfoService getDrbEasyDrugList 호출 (검색어 없이 또는 전체 totalCount 기준 pageNo 루프)
 * - itemName, efcyQesitm, useMethodQesitm, atpnQesitm, itemSeq → drug_master 컬럼 매핑 후 기존 조회·insert/update
 * - 페이지당 0.5초 delay로 공공 API 차단 방지
 *
 * 실행: node --import tsx scripts/hydrate-easy-drug.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const BASE = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList'
const PAGE_SIZE = 100
const DELAY_MS = 500

type EasyDrugItem = {
  itemName?: string
  itemSeq?: string
  entpName?: string
  efcyQesitm?: string | null
  useMethodQesitm?: string | null
  atpnQesitm?: string | null
  atpnWarnQesitm?: string | null
  [key: string]: unknown
}

function buildUrl(serviceKey: string, pageNo: number, numOfRows: number, itemName?: string): string {
  const params: Record<string, string> = {
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    type: 'json',
  }
  if (itemName !== undefined && itemName !== '') {
    params.itemName = itemName
  }
  const q = new URLSearchParams(params)
  return `${BASE}?${q.toString()}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPage(
  serviceKey: string,
  pageNo: number,
  numOfRows: number,
  itemName?: string
): Promise<{ totalCount: number; items: EasyDrugItem[] }> {
  const url = buildUrl(serviceKey, pageNo, numOfRows, itemName)
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(`API HTTP ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as {
    header?: { resultCode?: string; resultMsg?: string }
    body?: { totalCount?: number; items?: EasyDrugItem | EasyDrugItem[] }
  }
  const code = data?.header?.resultCode
  if (code !== '00' && code !== undefined) {
    throw new Error(`API ${code}: ${data?.header?.resultMsg ?? text.slice(0, 200)}`)
  }
  const body = data?.body ?? {}
  const totalCount = Number(body.totalCount ?? 0)
  const raw = body.items
  const items = Array.isArray(raw) ? raw : raw ? [raw] : []
  return { totalCount, items }
}

/**
 * API 한 건 → drug_master 행 매핑 (존재하는 컬럼만 사용)
 * - itemSeq(품목기준코드) → item_seq
 * - itemName(제품명) → product_name
 * - efcyQesitm + useMethodQesitm → ee_doc_data
 * - atpnQesitm 등 → nb_doc_data
 * - entpName → company_name
 */
function toDrugMasterRow(item: EasyDrugItem): {
  product_name: string
  item_seq: string | null
  company_name: string | null
  ee_doc_data: string | null
  nb_doc_data: string | null
} {
  const product_name = (item.itemName ?? '').trim() || 'unknown'
  const item_seq = (item.itemSeq ?? '').trim() || null
  const eeParts: string[] = []
  if (item.efcyQesitm) eeParts.push(String(item.efcyQesitm).trim())
  if (item.useMethodQesitm) eeParts.push('용법: ' + String(item.useMethodQesitm).trim())
  const ee_doc_data = eeParts.length ? eeParts.join('\n\n') : null
  const nb_doc_data = [item.atpnWarnQesitm, item.atpnQesitm]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .join('\n\n') || null

  return {
    product_name,
    item_seq,
    company_name: (item.entpName ?? '').trim() || null,
    ee_doc_data,
    nb_doc_data,
  }
}

async function main() {
  const apiKey = process.env.MFDS_SERVICE_KEY?.trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    console.error('❌ .env.local에 MFDS_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('═══════════════════════════════════════')
  console.log('  e-약은요 전체 데이터 추출 → drug_master')
  console.log('═══════════════════════════════════════\n')

  let totalCount: number
  let searchTerm: string | undefined = undefined // 검색어 없이 전체 조회 시도

  try {
    const first = await fetchPage(apiKey, 1, 1, searchTerm)
    totalCount = first.totalCount
    if (totalCount === 0) {
      console.log('[1페이지] 검색어 없음 → totalCount 0. itemName="가"로 재시도.')
      searchTerm = '가'
      const retry = await fetchPage(apiKey, 1, 1, searchTerm)
      totalCount = retry.totalCount
    } else {
      console.log('[1페이지] 검색어 없이 전체 totalCount 확보.')
    }
  } catch {
    console.log('[1페이지] 검색어 없음 실패. itemName="가"로 재시도.')
    searchTerm = '가'
    const retry = await fetchPage(apiKey, 1, 1, searchTerm)
    totalCount = retry.totalCount
  }

  console.log('전체 건수(totalCount):', totalCount)
  if (totalCount === 0) {
    console.log('처리할 데이터가 없습니다.')
    process.exit(0)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  let totalUpserted = 0

  for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
    if (pageNo > 1) await sleep(DELAY_MS)

    const { items } = await fetchPage(apiKey, pageNo, PAGE_SIZE, searchTerm)
    const rows = items.map(toDrugMasterRow).filter((r) => r.product_name !== 'unknown')

    if (rows.length === 0) {
      console.log(`  [${pageNo}/${totalPages}] 0건 스킵`)
      continue
    }

    const productNames = rows.map((r) => r.product_name)
    const { data: existing } = await supabase
      .from('drug_master')
      .select('product_name')
      .in('product_name', productNames)
    const existingSet = new Set((existing ?? []).map((r) => r.product_name))
    const toInsert = rows.filter((r) => !existingSet.has(r.product_name))
    const toUpdate = rows.filter((r) => existingSet.has(r.product_name))

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('drug_master').insert(toInsert)
      if (insertErr) {
        console.error(`  [${pageNo}/${totalPages}] insert 오류:`, insertErr.message)
        continue
      }
    }
    for (const row of toUpdate) {
      const { error: updateErr } = await supabase
        .from('drug_master')
        .update({
          item_seq: row.item_seq,
          company_name: row.company_name,
          ee_doc_data: row.ee_doc_data,
          nb_doc_data: row.nb_doc_data,
        })
        .eq('product_name', row.product_name)
      if (updateErr) {
        console.error(`  [${pageNo}/${totalPages}] update 오류 (${row.product_name}):`, updateErr.message)
      }
    }

    const affected = toInsert.length + toUpdate.length
    totalUpserted += affected
    console.log(`  [${pageNo}/${totalPages}] insert ${toInsert.length}건, update ${toUpdate.length}건 (누적 ${totalUpserted}건)`)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  완료. 총', totalUpserted, '건 반영')
  console.log('═══════════════════════════════════════')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
