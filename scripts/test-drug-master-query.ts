/**
 * drug_master 데이터 매칭 테스트: '아네모정', '포도당' 검색 시 DB에서 정상 조회되는지 확인.
 * product_name 컬럼과 ILIKE 부분 매칭 동작 확인.
 *
 * 실행: node --loader tsx scripts/test-drug-master-query.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local 확인)')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const keywords = ['아네모정', '포도당']

  for (const q of keywords) {
    const pattern = `%${escapeLikePattern(q)}%`
    const { data, error } = await supabase
      .from('drug_master')
      .select('product_name, main_ingredient, company_name')
      .ilike('product_name', pattern)
      .order('product_name', { ascending: true })
      .limit(20)

    console.log(`\n[drug_master] 키워드 "${q}" (pattern: ${pattern})`)
    if (error) {
      console.warn('쿼리 오류:', error.message)
      continue
    }
    const rows = Array.isArray(data) ? data : []
    console.log(`조회 로우 수: ${rows.length}건`)
    console.log('DB 결과:', JSON.stringify(rows, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
