/**
 * drug_master 보완: main_ingredient 또는 simple_desc가 NULL인 로우만 대상
 * - 성분 추출: 제품명(괄호) 또는 효능 문구에서 핵심 성분명 하나 → main_ingredient
 * - 한 줄 요약: ee_doc_data 기반 시니어용 한 줄 요약(기존 톤 유지) → simple_desc
 * - paper_insight 등 다른 컬럼은 건드리지 않음. 20건씩 배치 처리.
 *
 * 실행: node --import tsx scripts/fill-ingredient-and-desc.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const BATCH_SIZE = 20
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const DELAY_BETWEEN_BATCHES_MS = 1200

type Row = {
  id: string
  product_name: string
  ee_doc_data: string | null
  main_ingredient: string | null
  simple_desc: string | null
}
type Label = { main_ingredient: string | null; simple_desc: string }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  return createClient(url, key)
}

async function callClaudeBatch(apiKey: string, rows: Row[]): Promise<Label[]> {
  const list = rows
    .map(
      (r, i) =>
        `[${i + 1}]\n제품명: ${r.product_name}\n효능(ee_doc_data): ${r.ee_doc_data ?? '(없음)'}`
    )
    .join('\n\n---\n\n')
  const systemPrompt = `당신은 의약품 정보를 정리하는 전문가입니다.
각 항목마다 다음 두 가지만 출력합니다.
1) main_ingredient: 제품명 괄호 안 또는 효능 문구에서 핵심 성분명 하나만 추출. 예: "이부프로펜", "파라세타몰", "오메프라졸". 괄호 없으면 효능에서 대표 성분 하나만.
2) simple_desc: 효능(ee_doc_data)을 보고 시니어(어르신) 눈높이의 한 줄 요약. 예: "속이 쓰리고 신물이 올라올 때 먹는 약이에요", "머리 아프고 열 날 때 먹는 진통제예요". 따뜻하고 쉬운 말로 한 문장만.
응답은 반드시 유효한 JSON 배열 하나만 출력. 다른 설명 없이 [{ "main_ingredient": "...", "simple_desc": "..." }, ...] 형식. 순서는 입력 [1],[2],... 와 동일.`

  const userPrompt = `아래 ${rows.length}건에 대해 main_ingredient와 simple_desc를 JSON 배열로만 출력하세요. 순서대로 ${rows.length}개 객체.\n\n${list}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 400)}`)
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const textBlock = data?.content?.find((b) => b.type === 'text')
  const raw = (textBlock?.text ?? '').trim()
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  const jsonStr = jsonMatch ? jsonMatch[0] : raw
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`JSON 파싱 실패. raw 일부: ${raw.slice(0, 300)}`)
  }
  const arr = Array.isArray(parsed) ? parsed : []
  return arr.slice(0, rows.length).map((item: unknown) => {
    const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    return {
      main_ingredient: typeof o.main_ingredient === 'string' ? o.main_ingredient.trim() || null : null,
      simple_desc: typeof o.simple_desc === 'string' ? o.simple_desc.trim() || '' : '',
    }
  })
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey?.length) {
    console.error('ANTHROPIC_API_KEY가 .env.local에 없습니다.')
    process.exit(1)
  }
  const supabase = createSupabaseAdmin()

  // main_ingredient IS NULL OR simple_desc IS NULL 인 로우만
  const { count, error: countErr } = await supabase
    .from('drug_master')
    .select('*', { count: 'exact', head: true })
    .or('main_ingredient.is.null,simple_desc.is.null')
  if (countErr) {
    console.error('건수 조회 실패:', countErr.message)
    process.exit(1)
  }
  const total = count ?? 0
  const totalBatches = Math.ceil(total / BATCH_SIZE)
  console.log('대상(main_ingredient 또는 simple_desc NULL):', total, '건, 배치:', totalBatches)
  if (total === 0) {
    console.log('처리할 건이 없습니다.')
    return
  }

  let processed = 0
  let offset = 0
  while (true) {
    const { data: rows, error } = await supabase
      .from('drug_master')
      .select('id, product_name, ee_doc_data, main_ingredient, simple_desc')
      .or('main_ingredient.is.null,simple_desc.is.null')
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error(`[offset ${offset}] 조회 오류:`, error.message)
      break
    }
    if (!rows?.length) break

    try {
      const labels = await callClaudeBatch(apiKey, rows as Row[])
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as Row
        const label = labels[i] ?? { main_ingredient: null, simple_desc: '' }
        const updates: { main_ingredient?: string | null; simple_desc?: string | null } = {}
        if (row.main_ingredient == null && label.main_ingredient != null)
          updates.main_ingredient = label.main_ingredient
        if (row.simple_desc == null && label.simple_desc != null)
          updates.simple_desc = label.simple_desc
        if (Object.keys(updates).length === 0) continue
        const { error: updateErr } = await supabase
          .from('drug_master')
          .update(updates)
          .eq('id', row.id)
        if (updateErr) console.error(`  update 실패 ${row.product_name}:`, updateErr.message)
      }
      processed += rows.length
      console.log(`  [${Math.floor(offset / BATCH_SIZE) + 1}/${totalBatches}] ${rows.length}건 반영 (누적 ${processed}건)`)
    } catch (e) {
      console.error(`  [offset ${offset}] Claude 배치 오류:`, e instanceof Error ? e.message : e)
      break
    }

    offset += BATCH_SIZE
    if (offset >= total) break
    await sleep(DELAY_BETWEEN_BATCHES_MS)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  완료. 총', processed, '건 반영')
  console.log('═══════════════════════════════════════')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
