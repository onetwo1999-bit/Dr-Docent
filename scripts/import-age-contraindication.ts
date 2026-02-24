/**
 * DUR 연령금기 품목 → drug_master 업로드
 * - 원본: scripts/dur_age_contraindication_utf8.csv (2,890건, UTF-8)
 * - item_seq 기준으로 drug_master 행을 찾아 연령금기 관련 컬럼 업데이트
 * - 없는 item_seq는 신규 insert
 * - 연령조건 예시: 12 세 미만 / 18 세 이하 / 65 세 이상
 *
 * 실행 전: Supabase에서 supabase/drug_master-age-contraindication.sql 실행 필요
 * 실행: node --import tsx scripts/import-age-contraindication.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const CSV_PATH = path.join(__dirname, 'dur_age_contraindication_utf8.csv')
const BATCH_SIZE = 50

type AgeRow = {
  item_seq: string
  item_name: string
  main_ingr_name: string
  company_name: string
  age_limit_value: string
  age_limit_unit: string
  age_limit_condition: string
  age_contraindication_detail: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  return createClient(url, key)
}

async function readCsv(): Promise<AgeRow[]> {
  const rows: AgeRow[] = []
  const rl = createInterface({ input: createReadStream(CSV_PATH, 'utf-8'), crlfDelay: Infinity })
  let isHeader = true

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue }
    const cols: string[] = []
    let inQuote = false
    let cur = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        cols.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur)
    if (cols.length < 4) continue
    // 컬럼 순서: item_seq(0), item_name(1), main_ingr_name(2), main_ingr_name_raw(3),
    //             ingr_code(4), company_name(5), age_limit_value(6), age_limit_unit(7),
    //             age_limit_condition(8), notice_no(9), notice_date(10),
    //             age_contraindication_detail(11), reimbursement(12)
    rows.push({
      item_seq:                   cols[0]?.trim() ?? '',
      item_name:                  cols[1]?.trim() ?? '',
      main_ingr_name:             cols[2]?.trim() ?? '',
      company_name:               cols[5]?.trim() ?? '',
      age_limit_value:            cols[6]?.trim() ?? '',
      age_limit_unit:             cols[7]?.trim() ?? '',
      age_limit_condition:        cols[8]?.trim() ?? '',
      age_contraindication_detail:cols[11]?.trim() ?? '',
    })
  }
  return rows.filter((r) => r.item_seq && r.item_name)
}

async function main() {
  const supabase = createSupabaseAdmin()
  const rows = await readCsv()
  console.log(`CSV 로드: ${rows.length}건`)

  // 연령조건 분포 출력
  const condDist: Record<string, number> = {}
  rows.forEach(r => {
    const key = `${r.age_limit_value}${r.age_limit_unit} ${r.age_limit_condition}`
    condDist[key] = (condDist[key] ?? 0) + 1
  })
  const top = Object.entries(condDist).sort((a, b) => b[1] - a[1]).slice(0, 5)
  console.log('연령조건 상위 5:', Object.fromEntries(top))

  let updated = 0
  let inserted = 0
  let failed = 0
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE)

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const itemSeqs = batch.map((r) => r.item_seq)

    const { data: existing } = await supabase
      .from('drug_master')
      .select('id, item_seq')
      .in('item_seq', itemSeqs)
    const existingMap = new Map((existing ?? []).map((r) => [r.item_seq, r.id]))

    for (const row of batch) {
      const existingId = existingMap.get(row.item_seq)
      if (existingId) {
        const { error } = await supabase
          .from('drug_master')
          .update({
            age_contraindication:        true,
            age_limit_value:             row.age_limit_value || null,
            age_limit_unit:              row.age_limit_unit || null,
            age_limit_condition:         row.age_limit_condition || null,
            age_contraindication_detail: row.age_contraindication_detail || null,
          })
          .eq('id', existingId)
        if (error) { console.error(`  update 실패 ${row.item_seq}:`, error.message); failed++; continue }
        updated++
      } else {
        const { error } = await supabase.from('drug_master').insert({
          product_name:                row.item_name,
          item_seq:                    row.item_seq,
          company_name:                row.company_name || null,
          main_ingredient:             row.main_ingr_name || null,
          age_contraindication:        true,
          age_limit_value:             row.age_limit_value || null,
          age_limit_unit:              row.age_limit_unit || null,
          age_limit_condition:         row.age_limit_condition || null,
          age_contraindication_detail: row.age_contraindication_detail || null,
        })
        if (error) { console.error(`  insert 실패 ${row.item_seq}:`, error.message); failed++; continue }
        inserted++
      }
    }

    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    if (batchNo % 10 === 0 || batchNo === totalBatches) {
      console.log(`  [${batchNo}/${totalBatches}] update ${updated}건, insert ${inserted}건 완료`)
    }
    if (i + BATCH_SIZE < rows.length) await sleep(300)
  }

  console.log('\n═══════════════════════════════════════')
  console.log(`  완료. update ${updated}건 / insert ${inserted}건 / 실패 ${failed}건`)
  console.log('═══════════════════════════════════════')
}

main().catch((e) => { console.error(e); process.exit(1) })
