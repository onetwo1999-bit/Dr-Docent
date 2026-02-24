/**
 * DUR 용량주의 품목 → drug_master 업로드
 * - 원본: scripts/dur_dosage_limit_utf8.csv (6,710건, UTF-8)
 * - item_seq 기준으로 drug_master 행을 찾아 업데이트, 없으면 insert
 *
 * 실행 전: Supabase에서 supabase/drug_master-dosage-limit.sql 실행 필요
 * 실행: node --import tsx scripts/import-dosage-limit.ts
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

const CSV_PATH = path.join(__dirname, 'dur_dosage_limit_utf8.csv')
const BATCH_SIZE = 50

type Row = {
  item_seq: string; item_name: string; main_ingr_name: string
  max_daily_dose_desc: string; max_daily_dose_mg: string; component_content_mg: string
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  return createClient(url, key)
}

async function readCsv(): Promise<Row[]> {
  const rows: Row[] = []
  const rl = createInterface({ input: createReadStream(CSV_PATH, 'utf-8'), crlfDelay: Infinity })
  let isHeader = true
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue }
    const cols: string[] = []
    let inQuote = false, cur = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQuote && line[i+1] === '"') { cur += '"'; i++ } else inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { cols.push(cur); cur = '' }
      else cur += ch
    }
    cols.push(cur)
    if (cols.length < 4) continue
    // item_seq(0), item_name(1), main_ingr_name(2), raw(3), ingr_code(4),
    // max_daily_dose_desc(5), max_daily_dose_mg(6), component_content_mg(7), reimbursement(8), notice_no(9), notice_date(10)
    rows.push({
      item_seq:            cols[0]?.trim(),
      item_name:           cols[1]?.trim(),
      main_ingr_name:      cols[2]?.trim(),
      max_daily_dose_desc: cols[5]?.trim(),
      max_daily_dose_mg:   cols[6]?.trim(),
      component_content_mg:cols[7]?.trim(),
    })
  }
  return rows.filter(r => r.item_seq && r.item_name)
}

async function main() {
  const supabase = createAdmin()
  const rows = await readCsv()
  console.log(`CSV 로드: ${rows.length}건`)

  let updated = 0, inserted = 0, failed = 0
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE)

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { data: existing } = await supabase.from('drug_master').select('id, item_seq').in('item_seq', batch.map(r => r.item_seq))
    const map = new Map((existing ?? []).map(r => [r.item_seq, r.id]))

    for (const row of batch) {
      const id = map.get(row.item_seq)
      if (id) {
        const { error } = await supabase.from('drug_master').update({
          dosage_limit_caution:   true,
          max_daily_dose_desc:    row.max_daily_dose_desc || null,
          max_daily_dose_mg:      row.max_daily_dose_mg || null,
          component_content_mg:   row.component_content_mg || null,
        }).eq('id', id)
        if (error) { console.error(`  update 실패 ${row.item_seq}:`, error.message); failed++; continue }
        updated++
      } else {
        const { error } = await supabase.from('drug_master').insert({
          product_name:         row.item_name,
          item_seq:             row.item_seq,
          main_ingredient:      row.main_ingr_name || null,
          dosage_limit_caution: true,
          max_daily_dose_desc:  row.max_daily_dose_desc || null,
          max_daily_dose_mg:    row.max_daily_dose_mg || null,
          component_content_mg: row.component_content_mg || null,
        })
        if (error) { console.error(`  insert 실패 ${row.item_seq}:`, error.message); failed++; continue }
        inserted++
      }
    }
    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    if (batchNo % 10 === 0 || batchNo === totalBatches)
      console.log(`  [${batchNo}/${totalBatches}] update ${updated}건, insert ${inserted}건`)
    if (i + BATCH_SIZE < rows.length) await sleep(300)
  }

  console.log('\n═══════════════════════════════════════')
  console.log(`  완료. update ${updated} / insert ${inserted} / 실패 ${failed}`)
  console.log('═══════════════════════════════════════')
}

main().catch(e => { console.error(e); process.exit(1) })
