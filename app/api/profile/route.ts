import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 🔧 타입 정의
// ========================
interface ProfileInput {
  user_id?: string
  birth_date?: string | null
  gender?: string | null
  height?: string | number | null
  weight?: string | number | null
  conditions?: string | null
  medications?: string | null
  chronic_diseases?: string | null
  diseases?: string | null
}

interface ProfileData {
  id: string
  birth_date: string | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
  chronic_diseases: string | null
  bmi: number | null
}

// BMI 계산 함수
function calculateBMI(height: number | null, weight: number | null): number | null {
  if (!height || !weight || height <= 0) return null
  const heightInMeters = height / 100
  return Number((weight / (heightInMeters * heightInMeters)).toFixed(2))
}

interface ApiError {
  error: string
  code?: string
  details?: string
  field?: string
  received?: unknown
}

// ========================
// 🔄 데이터 타입 변환 유틸리티
// ========================
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  
  const num = Number(value)
  
  if (isNaN(num)) {
    console.warn(`⚠️ [타입 변환] "${value}" → NaN (null 반환)`)
    return null
  }
  
  return num
}

function toString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  return String(value).trim()
}

// ========================
// 🔍 입력 데이터 검증 및 변환
// ========================
function validateAndTransform(input: ProfileInput, authenticatedUserId: string): { 
  success: true; data: ProfileData 
} | { 
  success: false; error: ApiError 
} {
  console.log('🔍 [검증] 입력 데이터 검증 시작')
  console.log('   - 입력:', JSON.stringify(input, null, 2))
  
  // 1. user_id 검증
  const userId = input.user_id
  if (!userId) {
    return {
      success: false,
      error: {
        error: 'user_id가 필요합니다',
        code: 'MISSING_USER_ID',
        field: 'user_id'
      }
    }
  }
  
  // 2. 세션 검증: 인증된 사용자와 요청 user_id 일치 확인
  if (userId !== authenticatedUserId) {
    console.error(`❌ [보안] user_id 불일치! 요청: ${userId}, 인증: ${authenticatedUserId}`)
    return {
      success: false,
      error: {
        error: '권한이 없습니다. 자신의 프로필만 수정할 수 있습니다.',
        code: 'UNAUTHORIZED_USER_ID',
        details: `요청된 user_id(${userId.slice(0, 8)}...)가 인증된 사용자와 일치하지 않습니다.`
      }
    }
  }
  
  // 3. 데이터 타입 변환
  const height = toNumber(input.height)
  const weight = toNumber(input.weight)
  const gender = toString(input.gender)
  let birth_date: string | null = typeof input.birth_date === 'string' && input.birth_date.trim()
    ? input.birth_date.trim()
    : null

  const conditions = toString(input.conditions) || toString(input.diseases)
  const medications = toString(input.medications)
  const chronic_diseases = toString(input.chronic_diseases) || conditions

  const bmi = calculateBMI(height, weight)

  // 4. birth_date 검증 (YYYY-MM-DD, 미래일 불가, 합리적 범위)
  if (birth_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(birth_date)) {
      return {
        success: false,
        error: {
          error: '생년월일은 YYYY-MM-DD 형식이어야 합니다',
          code: 'INVALID_BIRTH_DATE',
          field: 'birth_date',
          received: input.birth_date
        }
      }
    }
    const bd = new Date(birth_date)
    if (isNaN(bd.getTime())) {
      return {
        success: false,
        error: {
          error: '올바른 생년월일을 입력해 주세요',
          code: 'INVALID_BIRTH_DATE',
          field: 'birth_date',
          received: input.birth_date
        }
      }
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (bd > today) {
      return {
        success: false,
        error: {
          error: '생년월일은 오늘 이후일 수 없습니다',
          code: 'INVALID_BIRTH_DATE',
          field: 'birth_date',
          received: input.birth_date
        }
      }
    }
    const minDate = new Date(today)
    minDate.setFullYear(minDate.getFullYear() - 120)
    if (bd < minDate) {
      return {
        success: false,
        error: {
          error: '생년월일이 유효 범위를 벗어났습니다',
          code: 'INVALID_BIRTH_DATE',
          field: 'birth_date',
          received: input.birth_date
        }
      }
    }
  }

  if (height !== null && (height < 50 || height > 300)) {
    return {
      success: false,
      error: {
        error: '키는 50-300cm 사이여야 합니다',
        code: 'INVALID_HEIGHT',
        field: 'height',
        received: input.height
      }
    }
  }
  
  if (weight !== null && (weight < 10 || weight > 500)) {
    return {
      success: false,
      error: {
        error: '몸무게는 10-500kg 사이여야 합니다',
        code: 'INVALID_WEIGHT',
        field: 'weight',
        received: input.weight
      }
    }
  }
  
  if (gender !== null && !['male', 'female'].includes(gender)) {
    return {
      success: false,
      error: {
        error: '성별은 male 또는 female이어야 합니다',
        code: 'INVALID_GENDER',
        field: 'gender',
        received: input.gender
      }
    }
  }
  
  console.log('✅ [검증] 검증 완료')
  
  return {
    success: true,
    data: {
      id: userId,
      birth_date,
      gender,
      height,
      weight,
      conditions,
      medications,
      chronic_diseases,
      bmi
    }
  }
}

// ========================
// 🔌 Route Handler 전용 Supabase 클라이언트
// ========================
async function createRouteHandlerClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Route Handler에서 쿠키 설정 실패 시 무시
          }
        },
      },
    }
  )
}

// ========================
// 📝 POST: 프로필 저장/업데이트
// ========================
export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8)
  console.log(`\n${'='.repeat(50)}`)
  console.log(`📝 [Profile API] POST 요청 시작 (ID: ${requestId})`)
  console.log(`${'='.repeat(50)}`)
  
  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1️⃣ 요청 본문 파싱
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let body: ProfileInput
    try {
      body = await req.json()
      console.log(`📋 [${requestId}] 받은 원본 데이터:`, JSON.stringify(body, null, 2))
    } catch (parseError) {
      console.error(`❌ [${requestId}] JSON 파싱 실패:`, parseError)
      return NextResponse.json({
        error: 'JSON 파싱 실패',
        code: 'INVALID_JSON',
        details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, { status: 400 })
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2️⃣ Supabase 클라이언트 생성 및 인증 확인
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const supabase = await createRouteHandlerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error(`❌ [${requestId}] 인증 에러:`, {
        message: authError.message,
        status: authError.status
      })
      return NextResponse.json({
        error: '인증 실패',
        code: 'AUTH_ERROR',
        details: authError.message
      }, { status: 401 })
    }
    
    if (!user) {
      console.error(`❌ [${requestId}] 인증된 사용자 없음`)
      return NextResponse.json({
        error: '로그인이 필요합니다',
        code: 'NOT_AUTHENTICATED'
      }, { status: 401 })
    }
    
    console.log(`👤 [${requestId}] 인증된 사용자: ${user.id}`)
    console.log(`📤 [${requestId}] 요청된 user_id: ${body.user_id}`)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3️⃣ 데이터 검증 및 변환 (세션 검증 포함)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const validation = validateAndTransform(body, user.id)
    
    if (!validation.success) {
      console.error(`❌ [${requestId}] 검증 실패:`, validation.error)
      return NextResponse.json(validation.error, { status: 400 })
    }
    
    const profileData = validation.data
    console.log(`💾 [${requestId}] 변환된 데이터:`, JSON.stringify(profileData, null, 2))

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4️⃣ Supabase Upsert 실행 (스키마 호환성 고려)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(`🔄 [${requestId}] Supabase upsert 시작...`)
    
    // 첫 번째 시도: 모든 필드 포함
    let upsertData: Record<string, unknown> = {
      id: profileData.id,
      birth_date: profileData.birth_date,
      gender: profileData.gender,
      height: profileData.height,
      weight: profileData.weight,
      conditions: profileData.conditions,
      medications: profileData.medications,
      chronic_diseases: profileData.chronic_diseases,
      bmi: profileData.bmi
    }
    
    let { data, error } = await supabase
      .from('profiles')
      .upsert(upsertData, { onConflict: 'id' })
      .select()

    // PGRST204 또는 스키마 캐시 에러 발생 시, 새 컬럼 제외하고 재시도
    if (error && (error.code === 'PGRST204' || 
                  error.message.includes('schema cache') ||
                  (error.message.includes('column') && error.message.includes('does not exist')))) {
      console.warn(`⚠️ [${requestId}] 스키마 불일치 감지, 필수 컬럼만으로 재시도...`)
      
      // 필수 컬럼만 포함 (기존 스키마 호환)
      const fallbackData: Record<string, unknown> = {
        id: profileData.id,
        birth_date: profileData.birth_date,
        gender: profileData.gender,
        height: profileData.height,
        weight: profileData.weight,
        conditions: profileData.conditions || profileData.chronic_diseases,
        medications: profileData.medications
      }
      
      const retryResult = await supabase
        .from('profiles')
        .upsert(fallbackData, { onConflict: 'id' })
        .select()
      
      if (retryResult.error) {
        error = retryResult.error
        data = null
      } else {
        // 재시도 성공
        console.log(`✅ [${requestId}] 필수 컬럼만으로 저장 성공 (스키마 업데이트 필요)`)
        data = retryResult.data
        
        // 사용자에게 스키마 업데이트 안내 포함
        return NextResponse.json({ 
          success: true, 
          data,
          message: '프로필이 저장되었습니다. (참고: BMI 등 일부 데이터는 스키마 업데이트 후 저장됩니다)',
          warning: 'profiles 테이블에 bmi, chronic_diseases 컬럼을 추가하려면 Supabase SQL Editor에서 profiles-schema-update.sql을 실행하세요.'
        })
      }
    }

    if (error) {
      console.error(`❌ [${requestId}] Supabase 에러:`, {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      
      // 에러 유형별 상세 응답
      let statusCode = 500
      let errorResponse: ApiError = {
        error: error.message,
        code: error.code,
        details: error.details || undefined
      }
      
      // RLS 정책 에러
      if (error.code === '42501' || error.message.includes('policy') || error.message.includes('permission')) {
        statusCode = 403
        errorResponse = {
          error: 'RLS 정책 에러: 프로필 저장 권한이 없습니다.',
          code: 'RLS_POLICY_VIOLATION',
          details: `Supabase 대시보드에서 profiles 테이블의 RLS 정책을 확인하세요. (원본: ${error.message})`
        }
      }
      
      // 컬럼 없음 에러 (PGRST204 포함)
      if (error.code === 'PGRST204' || 
          (error.message.includes('column') && error.message.includes('does not exist')) ||
          error.message.includes('schema cache')) {
        statusCode = 400
        const columnMatch = error.message.match(/column ['"]?(\w+)['"]?/i) || 
                           error.message.match(/['"](\w+)['"]/i)
        const missingColumn = columnMatch?.[1] || 'unknown'
        const scriptName = missingColumn === 'birth_date'
          ? 'profiles-birth-date-migration.sql'
          : 'profiles-schema-update.sql'
        errorResponse = {
          error: `데이터베이스 스키마가 업데이트되지 않았습니다.`,
          code: 'SCHEMA_MISMATCH',
          details: `'${missingColumn}' 컬럼이 profiles 테이블에 없습니다. Supabase 대시보드 → SQL Editor에서 supabase/${scriptName} 내용을 붙여넣고 실행한 뒤, Settings → API에서 "Reload schema"를 클릭해주세요.`,
          field: missingColumn
        }
      }
      
      // 테이블 없음 에러
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        statusCode = 500
        errorResponse = {
          error: 'profiles 테이블이 존재하지 않습니다.',
          code: 'TABLE_NOT_FOUND',
          details: 'Supabase에서 profiles 테이블을 생성해주세요.'
        }
      }
      
      // 데이터 타입 에러
      if (error.message.includes('invalid input syntax')) {
        statusCode = 400
        errorResponse = {
          error: '데이터 타입 오류',
          code: 'TYPE_ERROR',
          details: error.message
        }
      }
      
      return NextResponse.json(errorResponse, { status: statusCode })
    }

    console.log(`✅ [${requestId}] 저장 성공!`)
    console.log(`   - 저장된 데이터:`, JSON.stringify(data, null, 2))
    
    return NextResponse.json({ 
      success: true, 
      data,
      message: '프로필이 성공적으로 저장되었습니다.'
    })

  } catch (error) {
    console.error(`❌ [${requestId}] 예외 발생:`, error)
    
    // 스택 트레이스 출력
    if (error instanceof Error) {
      console.error(`   - 이름: ${error.name}`)
      console.error(`   - 메시지: ${error.message}`)
      console.error(`   - 스택:\n${error.stack}`)
    }
    
    return NextResponse.json({
      error: '서버 내부 오류',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// ========================
// 📖 GET: 프로필 조회
// ========================
export async function GET(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8)
  console.log(`\n📖 [Profile API] GET 요청 (ID: ${requestId})`)
  
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({
        error: 'user_id 파라미터가 필요합니다',
        code: 'MISSING_USER_ID'
      }, { status: 400 })
    }

    const supabase = await createRouteHandlerClient()
    
    // 인증 확인 (선택적 - 자신의 프로필만 조회 가능하게 하려면)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user && user.id !== userId) {
      console.warn(`⚠️ [${requestId}] 다른 사용자 프로필 조회 시도: ${userId}`)
      // 필요시 차단 가능
      // return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // 데이터 없음 (정상 케이스)
      if (error.code === 'PGRST116') {
        console.log(`📭 [${requestId}] 프로필 없음: ${userId}`)
        return NextResponse.json({ profile: null })
      }
      
      console.error(`❌ [${requestId}] 조회 에러:`, {
        message: error.message,
        code: error.code
      })
      
      return NextResponse.json({
        error: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log(`✅ [${requestId}] 조회 성공`)
    return NextResponse.json({ profile: data })

  } catch (error) {
    console.error(`❌ [${requestId}] 예외 발생:`, error)
    
    return NextResponse.json({
      error: '서버 내부 오류',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
