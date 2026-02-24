/**
 * DUR 노인주의(해열진통소염제) 품목 → drug_master 업로드
 * - 원본: scripts/dur_elderly_nsaid_utf8.csv (1,083건, UTF-8)
 * - item_seq 기준으로 drug_master 행을 찾아 elderly_nsaid_caution 관련 컬럼 업데이트
 * - 없는 item_seq는 신규 insert
 *
 * 실행 전: Supabase에서 supabase/drug_master-elderly-nsaid.sql 실행 필요
 * 실행: node --import tsx scripts/import-elderly-nsaid.ts
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

const CSV_PATH = path.join(__dirname, 'dur_elderly_nsaid_utf8.csv')
const BATCH_SIZE = 50

type NsaidRow = {
  item_seq: string
  item_name: string
  main_ingr_name: string
  company_name: string
  caution_detail: string
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

async function readCsv(): Promise<NsaidRow[]> {
  const rows: NsaidRow[] = []
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
    //             ingr_code(4), company_name(5), caution_detail(6), reimbursement(7)
    rows.push({
      item_seq:       cols[0]?.trim() ?? '',
      item_name:      cols[1]?.trim() ?? '',
      main_ingr_name: cols[2]?.trim() ?? '',
      company_name:   cols[5]?.trim() ?? '',
      caution_detail: cols[6]?.trim() ?? '',
    })
  }
  return rows.filter((r) => r.item_seq && r.item_name)
}

async function main() {
  const supabase = createSupabaseAdmin()
  const rows = await readCsv()
  console.log(`CSV 로드: ${rows.length}건`)

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
            elderly_nsaid_caution:       true,
            elderly_nsaid_caution_detail: row.caution_detail || null,
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
          elderly_nsaid_caution:       true,
          elderly_nsaid_caution_detail: row.caution_detail || null,
        })
        if (error) { console.error(`  insert 실패 ${row.item_seq}:`, error.message); failed++; continue }
        inserted++
      }
    }

    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    if (batchNo % 5 === 0 || batchNo === totalBatches) {
      console.log(`  [${batchNo}/${totalBatches}] update ${updated}건, insert ${inserted}건 완료`)
    }
    if (i + BATCH_SIZE < rows.length) await sleep(300)
  }

  console.log('\n═══════════════════════════════════════')
  console.log(`  완료. update ${updated}건 / insert ${inserted}건 / 실패 ${failed}건`)
  console.log('═══════════════════════════════════════')
}

main().catch((e) => { console.error(e); process.exit(1) })
