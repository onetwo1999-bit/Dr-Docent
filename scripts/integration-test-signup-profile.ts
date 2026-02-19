/**
 * 통합 테스트: 회원가입 시 profiles 테이블에 유저 ID·닉네임 자동 생성 여부 검증
 *
 * 전략: admin.auth.admin.createUser() 사용 → 이메일 인증 불필요, 트리거만 검증
 * - email_confirm: true 로 즉시 인증된 유저 생성 (실제 이메일 발송 없음)
 * - 트리거(handle_new_user)가 auth.users INSERT 시 profiles에 행을 넣는지 확인
 *
 * 사용법:
 *   npx tsx scripts/integration-test-signup-profile.ts
 *   npm run test:signup-profile
 *
 * 필요 환경변수 (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  const content = readFileSync(path, 'utf8')
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_NICKNAME = `TestNick_${Date.now()}`
const TEST_EMAIL = `integration-test-${Date.now()}@dr-docent-test.local`
const TEST_PASSWORD = 'Integration!Test#9'

const PASS = (msg: string) => console.log(`   ✅ ${msg}`)
const FAIL = (msg: string) => { console.error(`   ❌ ${msg}`); process.exit(1) }
const WARN = (msg: string) => console.warn(`   ⚠️  ${msg}`)
const STEP = (n: number, msg: string) => console.log(`\n${n}️⃣  ${msg}`)

async function run() {
  console.log('\n🧪 닥터 도슨 — 회원가입 → profiles 자동 생성 통합 테스트')
  console.log('─'.repeat(56))
  console.log('  닉네임:', TEST_NICKNAME)
  console.log('  이메일:', TEST_EMAIL)

  if (!SUPABASE_URL) FAIL('NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.')
  if (!SUPABASE_SERVICE_ROLE_KEY) FAIL('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.')

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let userId: string | null = null

  try {
    // ─────────────────────────────────────────────────────
    // STEP 1: admin API로 유저 생성 (이메일 인증 없이 즉시 생성)
    //   → auth.users INSERT 시 on_auth_user_created 트리거가 발화
    // ─────────────────────────────────────────────────────
    STEP(1, 'admin API로 테스트 유저 생성 (닉네임 메타데이터 포함)')
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { nickname: TEST_NICKNAME },
    })

    if (createErr) {
      if (createErr.message.includes('Database error')) {
        console.error('\n   ❌ createUser 실패:', createErr.message)
        console.error('\n   【필수 조치】 트리거가 유저 생성을 막고 있습니다.')
        console.error('   Supabase 대시보드 → SQL Editor에서 아래 파일 내용을 실행하세요:')
        console.error('   → supabase/trigger-profiles-on-signup.sql')
        console.error('\n   실행 후 다시 테스트하세요: npm run test:signup-profile\n')
        process.exit(1)
      }
      FAIL(`createUser 실패: ${createErr.message}`)
    }
    if (!created?.user?.id) FAIL('createUser 후 user.id 없음')

    userId = created!.user!.id
    PASS(`유저 생성됨  id: ${userId.slice(0, 8)}…`)

    // ─────────────────────────────────────────────────────
    // STEP 2: 트리거 처리 대기 (DB 비동기)
    // ─────────────────────────────────────────────────────
    STEP(2, '트리거 처리 대기 (500 ms)')
    await new Promise((r) => setTimeout(r, 500))
    PASS('대기 완료')

    // ─────────────────────────────────────────────────────
    // STEP 3: profiles 테이블에서 해당 행 조회
    // ─────────────────────────────────────────────────────
    STEP(3, 'profiles 테이블 행 확인')
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, nickname, updated_at')
      .eq('id', userId)
      .single()

    if (profileErr) {
      if (profileErr.code === 'PGRST116') {
        FAIL(
          'profiles 행이 없습니다.\n' +
          '     → supabase/trigger-profiles-on-signup.sql 을 Supabase SQL Editor에서 실행한 뒤 다시 테스트하세요.'
        )
      }
      FAIL(`profiles 조회 실패: ${profileErr.message}`)
    }

    PASS(`profiles 행 존재  id: ${profile!.id.slice(0, 8)}…`)

    // ─────────────────────────────────────────────────────
    // STEP 4: id 일치 검증
    // ─────────────────────────────────────────────────────
    STEP(4, 'profiles.id === auth.users.id 검증')
    if (profile!.id !== userId) {
      FAIL(`id 불일치  기대: ${userId}  실제: ${profile!.id}`)
    }
    PASS(`id 일치 확인`)

    // ─────────────────────────────────────────────────────
    // STEP 5: nickname 일치 검증
    // ─────────────────────────────────────────────────────
    STEP(5, 'profiles.nickname 검증')
    const nick = profile!.nickname as string | null
    if (!nick) {
      WARN(
        'profiles.nickname 이 null 입니다.\n' +
        '     nickname 컬럼이 profiles 테이블에 없을 수 있습니다.\n' +
        '     supabase/profiles-chart-number-nickname.sql 을 실행한 뒤 트리거를 재설정하세요.'
      )
    } else if (nick !== TEST_NICKNAME) {
      FAIL(`nickname 불일치  기대: "${TEST_NICKNAME}"  실제: "${nick}"`)
    } else {
      PASS(`nickname 일치: "${nick}"`)
    }

    // ─────────────────────────────────────────────────────
    // 결과
    // ─────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(56))
    if (nick === TEST_NICKNAME) {
      console.log('🎉 모든 항목 통과: 회원가입 시 profiles에 id·닉네임이 자동 생성됩니다.')
    } else {
      console.log('🟡 부분 통과: id 자동 생성은 OK, nickname 은 컬럼 추가 후 재확인 필요.')
    }
    console.log('─'.repeat(56) + '\n')
  } finally {
    // ─────────────────────────────────────────────────────
    // 정리: 테스트 유저 삭제 (profiles는 CASCADE로 자동 삭제)
    // ─────────────────────────────────────────────────────
    if (userId) {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId)
      if (delErr) WARN(`테스트 유저 삭제 실패 (수동 삭제 필요): ${delErr.message}`)
      else console.log('   🧹 테스트 유저 및 profiles 행 삭제 완료')
    }
  }
}

run().catch((err) => {
  console.error('\n💥 예상치 못한 오류:', err)
  process.exit(1)
})
