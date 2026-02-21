/**
 * drug_master AI 라벨링: ee_doc_data(효능) → category + simple_desc
 * - 모델: Claude Sonnet 4.6 (claude-3-5-sonnet 단종으로 4.x 사용)
 * - 50건씩 배치 처리, 성공 시마다 DB 즉시 update
 *
 * 실행 전: Supabase에서 supabase/drug_master-ai-labels.sql 실행 필요
 * 실행: node --import tsx scripts/label-drug-master-ai.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const BATCH_SIZE = 50
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const DELAY_BETWEEN_BATCHES_MS = 1500

type Row = { id: string; product_name: string; ee_doc_data: string | null }
type Label = { category: string; simple_desc: string }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  return createClient(url, key)
}

async function callClaudeLabelBatch(
  apiKey: string,
  texts: string[]
): Promise<Label[]> {
  const list = texts
    .map((t, i) => `[${i + 1}]\n${t}`)
    .join('\n\n---\n\n')
  const systemPrompt = `당신은 의약품 효능 문서를 분류·요약하는 전문가입니다.
주어진 효능(ee_doc_data) 목록에 대해, 각 항목마다 반드시 다음 두 가지만 출력합니다.
1) category: 한 단어 분류 (예: 위장약, 해열진통제, 소화제, 진통제, 비타민, 당뇨약, 고혈압약, 감기약, 알레르기약, 진정제, 근육이완제, 기타 등)
2) simple_desc: 시니어(어르신) 눈높이에 맞춘 한 줄 요약. 예: "속이 쓰리고 신물이 올라올 때 먹는 약이에요"
응답은 반드시 유효한 JSON 배열 하나만 출력하세요. 다른 설명 없이 [{ "category": "...", "simple_desc": "..." }, ...] 형식으로만 출력. 항목 순서는 입력 [1],[2],... 순서와 동일하게 유지.`

  const userPrompt = `아래 효능 문서 ${texts.length}건에 대해 category와 simple_desc를 JSON 배열로만 출력하세요. 순서대로 ${texts.length}개 객체를 반드시 포함하세요.\n\n${list}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
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
  return arr.slice(0, texts.length).map((item: unknown) => {
    const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    return {
      category: typeof o.category === 'string' ? o.category.trim() || '기타' : '기타',
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

  // drug_master에 category, simple_desc 컬럼 존재 여부 확인 (마이그레이션 미실행 시 즉시 안내)
  const { error: schemaErr } = await supabase
    .from('drug_master')
    .select('category, simple_desc')
    .limit(1)
  if (schemaErr?.message?.includes('category') || schemaErr?.message?.includes('schema cache')) {
    console.error('오류: drug_master 테이블에 category, simple_desc 컬럼이 없습니다.')
    console.error('Supabase 대시보드 → SQL Editor에서 아래 파일 내용을 실행한 뒤 다시 시도하세요.')
    console.error('  파일: supabase/drug_master-ai-labels.sql')
    console.error('  내용: ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS category TEXT;')
    console.error('        ALTER TABLE drug_master ADD COLUMN IF NOT EXISTS simple_desc TEXT;')
    process.exit(1)
  }

  // 미라벨링 건만 대상 (category IS NULL → 크레딧 부족 등으로 중단 후 재실행 시 이어서 처리)
  const { count, error: countErr } = await supabase
    .from('drug_master')
    .select('*', { count: 'exact', head: true })
    .not('ee_doc_data', 'is', null)
    .is('category', null)
  if (countErr) {
    console.error('건수 조회 실패:', countErr.message)
    process.exit(1)
  }
  const total = count ?? 0
  const totalBatches = Math.ceil(total / BATCH_SIZE)
  console.log('drug_master 미라벨링 대상(ee_doc_data 있음, category 없음):', total, '건, 배치:', totalBatches)
  if (total === 0) {
    console.log('처리할 건이 없습니다. (이미 모두 라벨링되었거나 ee_doc_data가 비어 있음)')
    return
  }

  let processed = 0
  let offset = 0
  while (true) {
    const { data: rows, error } = await supabase
      .from('drug_master')
      .select('id, product_name, ee_doc_data')
      .not('ee_doc_data', 'is', null)
      .is('category', null)
      .order('id', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error(`[offset ${offset}] 조회 오류:`, error.message)
      break
    }
    if (!rows?.length) break

    const texts = rows.map((r) => (r.ee_doc_data ?? '').trim()).filter(Boolean)
    if (texts.length === 0) {
      offset += rows.length
      continue
    }

    try {
      const labels = await callClaudeLabelBatch(apiKey, texts)
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const label = labels[i] ?? { category: '기타', simple_desc: '' }
        const { error: updateErr } = await supabase
          .from('drug_master')
          .update({ category: label.category, simple_desc: label.simple_desc || null })
          .eq('id', row.id)
        if (updateErr) {
          console.error(`  update 실패 ${row.product_name}:`, updateErr.message)
        }
      }
      processed += rows.length
      console.log(`  [${Math.floor(offset / BATCH_SIZE) + 1}/${totalBatches}] ${rows.length}건 라벨링 반영 (누적 ${processed}건)`)
    } catch (e) {
      console.error(`  [offset ${offset}] Claude 배치 오류:`, e instanceof Error ? e.message : e)
      break
    }

    offset += BATCH_SIZE
    if (offset >= total) break
    await sleep(DELAY_BETWEEN_BATCHES_MS)
  }

  console.log('\n═══════════════════════════════════════')
  console.log('  완료. 총', processed, '건 라벨링 반영')
  console.log('═══════════════════════════════════════')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
