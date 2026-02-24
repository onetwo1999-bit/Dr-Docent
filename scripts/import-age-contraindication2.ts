/**
 * DUR 연령금기약물2 업로드 스크립트 (2024-06-25 버전)
 * 소스: scripts/dur_age_contraindication2_utf8.csv
 * 대상: drug_master (item_seq 기준 upsert)
 *
 * 실행: npx tsx scripts/import-age-contraindication2.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CSV_PATH = path.resolve(__dirname, 'dur_age_contraindication2_utf8.csv')
const BATCH_SIZE = 200

interface CsvRow {
  item_seq: string
  item_name: string
  main_ingr_name: string
  main_ingr_name_raw: string
  ingr_code: string
  company_name: string
  age_limit_value: string
  age_limit_unit: string
  age_limit_condition: string
  notice_no: string
  notice_date: string
  age_contraindication_detail: string
  reimbursement: string
}

async function parseCsv(filePath: string): Promise<CsvRow[]> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
  const lines: string[] = []
  for await (const line of rl) lines.push(line)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim())
  return lines.slice(1).map((line) => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? []
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g, '').trim() })
    return obj as unknown as CsvRow
  })
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`파일 없음: ${CSV_PATH}`)
    process.exit(1)
  }

  const rows = await parseCsv(CSV_PATH)
  console.log(`CSV 로드: ${rows.length}건`)

  let inserted = 0, updated = 0, errors = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const itemSeqs = batch.map((r) => r.item_seq).filter(Boolean)

    const { data: existing } = await supabase
      .from('drug_master')
      .select('item_seq')
      .in('item_seq', itemSeqs)

    const existingSet = new Set((existing ?? []).map((r: { item_seq: string }) => r.item_seq))

    const toInsert = batch.filter((r) => !existingSet.has(r.item_seq))
    const toUpdate = batch.filter((r) => existingSet.has(r.item_seq))

    const makePayload = (r: CsvRow) => ({
      item_seq:                    r.item_seq,
      item_name:                   r.item_name,
      age_contraindication:        true,
      age_limit_value:             r.age_limit_value || null,
      age_limit_unit:              r.age_limit_unit || null,
      age_limit_condition:         r.age_limit_condition || null,
      age_contraindication_detail: r.age_contraindication_detail || null,
    })

    if (toInsert.length > 0) {
      const { error } = await supabase.from('drug_master').insert(toInsert.map(makePayload))
      if (error) { console.error(`insert 오류 (배치 ${i})`, error.message); errors++ }
      else inserted += toInsert.length
    }

    for (const r of toUpdate) {
      const { error } = await supabase
        .from('drug_master')
        .update({
          age_contraindication:        true,
          age_limit_value:             r.age_limit_value || null,
          age_limit_unit:              r.age_limit_unit || null,
          age_limit_condition:         r.age_limit_condition || null,
          age_contraindication_detail: r.age_contraindication_detail || null,
        })
        .eq('item_seq', r.item_seq)
      if (error) { console.error(`update 오류 item_seq=${r.item_seq}`, error.message); errors++ }
      else updated++
    }

    console.log(`진행: ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}  (신규 ${inserted} / 갱신 ${updated} / 오류 ${errors})`)
  }

  console.log(`\n완료 — 신규 INSERT: ${inserted}건 / UPDATE: ${updated}건 / 오류: ${errors}건`)
}

main().catch(console.error)
