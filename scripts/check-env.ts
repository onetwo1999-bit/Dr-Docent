/**
 * 🔍 프로덕션 환경 변수 체크 스크립트
 * 
 * 사용법: npx tsx scripts/check-env.ts
 * 또는: npm run check-env
 */

const REQUIRED_ENV_VARS = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase 프로젝트 URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase Anon Key',
  
  // AI APIs
  ANTHROPIC_API_KEY: 'Anthropic Claude API Key',
  OPENAI_API_KEY: 'OpenAI API Key',
  
  // PWA Push Notifications
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'VAPID 공개 키',
  VAPID_PRIVATE_KEY: 'VAPID 개인 키',
}

const OPTIONAL_ENV_VARS = {
  NEXT_PUBLIC_APP_URL: '앱 URL (기본값: https://dr-docent.vercel.app)',
  PUBMED_API_KEY: 'PubMed E-utilities API Key (논문 검색용)',
  SEMANTIC_SCHOLAR_API_KEY: 'Semantic Scholar API Key (인용·TLDR 수집용)',
}

const PRODUCTION_DOMAIN = 'dr-docent.vercel.app'

function checkEnvVars() {
  console.log('\n🔍 프로덕션 환경 변수 체크 시작...\n')
  console.log('='.repeat(60))
  
  let hasErrors = false
  let hasWarnings = false
  
  // 필수 환경 변수 체크
  console.log('\n📋 필수 환경 변수:')
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key]
    if (!value) {
      console.error(`  ❌ ${key}: 누락됨 - ${description}`)
      hasErrors = true
    } else {
      // 민감한 정보는 일부만 표시
      const preview = key.includes('KEY') || key.includes('SECRET')
        ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}`
        : value
      console.log(`  ✅ ${key}: ${preview}`)
    }
  }
  
  // 선택적 환경 변수 체크
  console.log('\n📋 선택적 환경 변수:')
  for (const [key, description] of Object.entries(OPTIONAL_ENV_VARS)) {
    const value = process.env[key]
    if (!value) {
      console.warn(`  ⚠️  ${key}: 설정되지 않음 - ${description}`)
      hasWarnings = true
    } else {
      console.log(`  ✅ ${key}: ${value}`)
    }
  }
  
  // 도메인 체크
  console.log('\n🌐 도메인 설정:')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && !appUrl.includes(PRODUCTION_DOMAIN)) {
    console.warn(`  ⚠️  NEXT_PUBLIC_APP_URL이 프로덕션 도메인을 포함하지 않음: ${appUrl}`)
    console.warn(`     예상: https://${PRODUCTION_DOMAIN}`)
    hasWarnings = true
  } else if (!appUrl) {
    console.log(`  ℹ️  NEXT_PUBLIC_APP_URL이 설정되지 않음 (기본값 사용: https://${PRODUCTION_DOMAIN})`)
  } else {
    console.log(`  ✅ NEXT_PUBLIC_APP_URL: ${appUrl}`)
  }
  
  // VAPID 키 형식 체크
  console.log('\n🔑 VAPID 키 형식 체크:')
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  
  if (vapidPublic) {
    // Base64 URL-safe 형식인지 확인
    const isValidFormat = /^[A-Za-z0-9_-]+$/.test(vapidPublic)
    if (!isValidFormat) {
      console.error(`  ❌ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 잘못된 형식 (Base64 URL-safe 형식이어야 함)`)
      hasErrors = true
    } else {
      console.log(`  ✅ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 형식 확인됨`)
    }
  }
  
  if (vapidPrivate) {
    const isValidFormat = /^[A-Za-z0-9_-]+$/.test(vapidPrivate)
    if (!isValidFormat) {
      console.error(`  ❌ VAPID_PRIVATE_KEY: 잘못된 형식 (Base64 URL-safe 형식이어야 함)`)
      hasErrors = true
    } else {
      console.log(`  ✅ VAPID_PRIVATE_KEY: 형식 확인됨`)
    }
  }
  
  // Supabase URL 형식 체크
  console.log('\n🗄️  Supabase 설정:')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    const isValidUrl = supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co')
    if (!isValidUrl) {
      console.error(`  ❌ NEXT_PUBLIC_SUPABASE_URL: 잘못된 형식 (https://*.supabase.co 형식이어야 함)`)
      hasErrors = true
    } else {
      console.log(`  ✅ NEXT_PUBLIC_SUPABASE_URL: 형식 확인됨`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  
  if (hasErrors) {
    console.error('\n❌ 필수 환경 변수가 누락되었거나 형식이 잘못되었습니다.')
    console.error('   Vercel 대시보드에서 환경 변수를 확인해주세요.\n')
    process.exit(1)
  }
  
  if (hasWarnings) {
    console.warn('\n⚠️  일부 선택적 환경 변수가 설정되지 않았습니다.')
    console.warn('   프로덕션에서 정상 작동하지만 권장 사항을 확인해주세요.\n')
  } else {
    console.log('\n✅ 모든 환경 변수가 정상적으로 설정되었습니다!\n')
  }
  
  process.exit(0)
}

checkEnvVars()
