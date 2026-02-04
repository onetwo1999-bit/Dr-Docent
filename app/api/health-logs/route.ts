import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 📊 Health Logs API
// 식사, 운동, 복약 기록 저장/조회
// ========================

type CategoryType = 'meal' | 'exercise' | 'medication'

// 카테고리별 한글 라벨
const categoryLabels: Record<CategoryType, string> = {
  meal: '식사',
  exercise: '운동',
  medication: '복약'
}

// Supabase 클라이언트 생성 (Route Handler용)
async function createClient() {
  try {
    const cookieStore = await cookies()
    
    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ [Health Logs] 환경 변수 누락:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      })
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
    }
    
    // 🔍 쿠키 확인 (디버깅용)
    const allCookies = cookieStore.getAll()
    const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') || c.name.includes('auth'))
    const authCookies = allCookies.filter(c => c.name.startsWith('sb-'))
    
    if (!hasAuthCookie) {
      console.warn('⚠️ [Health Logs] 인증 쿠키가 없습니다. 모든 쿠키:', allCookies.map(c => c.name))
    } else {
      console.log('✅ [Health Logs] 인증 쿠키 발견:', authCookies.map(c => c.name))
    }
    
    // createServerClient로 Route Handler 클라이언트 생성
    const client = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { 
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            // Route Handler에서는 쿠키 설정이 제한적이지만 시도
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                // 쿠키는 Response 헤더를 통해 설정되므로 여기서는 로그만
                console.debug(`🍪 [Health Logs] 쿠키 설정 시도: ${name}`)
              })
            } catch (err) {
              // Route Handler에서 쿠키 설정 실패는 정상 (Response 헤더로 설정됨)
              console.debug('ℹ️ [Health Logs] 쿠키 설정 (Route Handler 제한):', err)
            }
          },
        },
      }
    )
    
    // 인증 컨텍스트 확인 (디버깅용)
    const { data: { user }, error: testAuth } = await client.auth.getUser()
    if (testAuth) {
      console.warn('⚠️ [Health Logs] 클라이언트 생성 시 인증 확인 실패:', testAuth.message)
    } else if (user) {
      console.log('✅ [Health Logs] 클라이언트 생성 시 인증 확인 성공:', user.id)
    }
    
    return client
  } catch (err: any) {
    console.error('❌ [Health Logs] 클라이언트 생성 실패:', err)
    throw new Error(`Supabase 클라이언트 생성 실패: ${err?.message || String(err)}`)
  }
}

// ========================
// POST: 건강 로그 추가
// ========================
export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
  console.log(`\n📝 [Health Logs] POST 요청 시작 (ID: ${requestId})`)
  
  try {
    // JSON 파싱 (안전하게)
    let body: any
    try {
      body = await req.json()
      console.log(`📦 [${requestId}] 요청 본문:`, { 
        category: body.category, 
        hasNotes: !!body.notes, 
        hasNote: !!body.note, 
        hasIntensityMetrics: !!body.intensity_metrics,
        weight_kg: body.weight_kg,
        reps: body.reps,
        sets: body.sets
      })
    } catch (parseError: any) {
      console.error(`❌ [${requestId}] JSON 파싱 실패:`, parseError)
      return NextResponse.json(
        { 
          success: false, 
          error: '요청 데이터 형식이 올바르지 않습니다.',
          details: parseError?.message || 'JSON 파싱 실패'
        },
        { status: 400 }
      )
    }

    const { 
      category, 
      note, 
      notes: bodyNotes,
      logged_at, 
      sub_type, 
      quantity, 
      unit, 
      schedule_id,
      // 식사 관련
      meal_description,
      image_url,
      // 운동 관련
      exercise_type,
      duration_minutes,
      heart_rate,
      intensity_metrics: bodyIntensityMetrics,
      weight_kg: bodyWeightKg,
      reps: bodyReps,
      sets: bodySets,
      // 복약 관련
      medication_name,
      medication_dosage,
      medication_ingredients
    } = body
    
    // note와 notes 필드명 통일: notes로 통일 (note는 하위 호환성을 위해 받지만 notes로 통합)
    const notes = bodyNotes ?? note ?? null

    // 무게, 횟수, 세트 값을 안전하게 숫자로 변환 (데이터 무결성 보장)
    // 값이 없으면 null, 있으면 반드시 Number()로 감싸서 숫자 타입으로 변환
    // 특히 빈 문자열("")은 null로 변환
    let weightKg: number | null = null
    let repsValue: number | null = null
    let setsValue: number | null = null
    
    // weight_kg 처리: 빈 문자열("")이면 null, 그 외에는 Number()로 변환
    if (bodyWeightKg !== undefined && bodyWeightKg !== null && bodyWeightKg !== '') {
      const strValue = String(bodyWeightKg).trim()
      if (strValue !== '') {
        const parsed = Number(strValue)
        if (!isNaN(parsed) && parsed > 0) {
          weightKg = parsed
        }
      }
    }
    
    // reps 처리: 빈 문자열("")이면 null, 그 외에는 Number()로 변환
    if (bodyReps !== undefined && bodyReps !== null && bodyReps !== '') {
      const strValue = String(bodyReps).trim()
      if (strValue !== '') {
        const parsed = Number(strValue)
        if (!isNaN(parsed) && parsed > 0) {
          repsValue = parsed
        }
      }
    }
    
    // sets 처리: 빈 문자열("")이면 null, 그 외에는 Number()로 변환
    if (bodySets !== undefined && bodySets !== null && bodySets !== '') {
      const strValue = String(bodySets).trim()
      if (strValue !== '') {
        const parsed = Number(strValue)
        if (!isNaN(parsed) && parsed > 0) {
          setsValue = parsed
        }
      }
    }
    
    console.log(`🔢 [${requestId}] 무게/횟수/세트 변환 결과:`, {
      원본값: { bodyWeightKg, bodyReps, bodySets },
      변환후: { weightKg, repsValue, setsValue },
      타입확인: {
        weightKg_type: typeof weightKg,
        repsValue_type: typeof repsValue,
        setsValue_type: typeof setsValue
      }
    })

    // 운동 시 intensity_metrics 보강: 평균 심박수·운동 시간이 JSONB에 정확히 담기도록
    // 무게, 횟수, 세트 등 모든 운동 정보가 누락 없이 포함되도록 보강
    const intensity_metrics =
      category === 'exercise'
        ? (bodyIntensityMetrics && typeof bodyIntensityMetrics === 'object'
            ? {
                ...bodyIntensityMetrics,
                duration_minutes:
                  bodyIntensityMetrics.duration_minutes ?? duration_minutes ?? null,
                average_heart_rate:
                  bodyIntensityMetrics.average_heart_rate ??
                  bodyIntensityMetrics.heart_rate ??
                  heart_rate ??
                  null,
                heart_rate:
                  bodyIntensityMetrics.heart_rate ?? heart_rate ?? null,
                exercise_type:
                  bodyIntensityMetrics.exercise_type ?? exercise_type ?? null,
                // 무게, 횟수, 세트 정보가 있으면 포함 (body에서 직접 받은 값 우선)
                ...(weightKg !== null && { weight_kg: weightKg }),
                ...(repsValue !== null && { reps: repsValue }),
                ...(setsValue !== null && { sets: setsValue }),
                // intensity_metrics에 이미 포함된 경우도 고려 (하위 호환성)
                ...(bodyIntensityMetrics.weight_kg !== undefined && weightKg === null && { weight_kg: bodyIntensityMetrics.weight_kg }),
                ...(bodyIntensityMetrics.reps !== undefined && repsValue === null && { reps: bodyIntensityMetrics.reps }),
                ...(bodyIntensityMetrics.sets !== undefined && setsValue === null && { sets: bodyIntensityMetrics.sets }),
              }
            : {
                duration_minutes: duration_minutes ?? null,
                average_heart_rate: heart_rate ?? null,
                heart_rate: heart_rate ?? null,
                ...(exercise_type && { exercise_type: exercise_type }),
              })
        : bodyIntensityMetrics

    // 유효성 검사
    if (!category || !['meal', 'exercise', 'medication'].includes(category)) {
      console.error(`❌ [${requestId}] 유효하지 않은 카테고리:`, category)
      return NextResponse.json(
        { success: false, error: '유효하지 않은 카테고리입니다.' },
        { status: 400 }
      )
    }

    console.log(`🔧 [${requestId}] Supabase 클라이언트 생성 중...`)
    const supabase = await createClient()
    console.log(`✅ [${requestId}] 클라이언트 생성 완료`)
    
    // 🔐 인증 확인 - 반드시 먼저 실행 (getUser()가 자동으로 세션을 갱신함)
    console.log(`🔐 [${requestId}] 인증 확인 중...`)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error(`❌ [${requestId}] 인증 에러:`, {
        message: authError.message,
        status: authError.status,
        name: authError.name
      })
      return NextResponse.json(
        { 
          success: false, 
          error: '로그인이 필요합니다.',
          details: authError.message || '인증 세션이 유효하지 않습니다.',
          code: authError.status || 401,
          hint: '페이지를 새로고침하거나 다시 로그인해주세요.'
        },
        { status: 401 }
      )
    }

    if (!user || !user.id) {
      console.error(`❌ [${requestId}] 유저 정보 없음:`, { 
        hasUser: !!user, 
        userId: user?.id,
        userEmail: user?.email
      })
      return NextResponse.json(
        { 
          success: false, 
          error: '로그인이 필요합니다.',
          details: '유저 세션이 만료되었거나 유효하지 않습니다.',
          hint: '페이지를 새로고침하거나 다시 로그인해주세요.'
        },
        { status: 401 }
      )
    }

    // 🔍 user.id 검증 (UUID 형식 - Supabase는 UUID v4 사용)
    if (typeof user.id !== 'string' || user.id.length < 30) {
      console.error(`❌ [${requestId}] 유효하지 않은 user_id:`, {
        user_id: user.id,
        type: typeof user.id,
        length: user.id?.length
      })
      return NextResponse.json(
        { 
          success: false, 
          error: '유효하지 않은 사용자 정보입니다.',
          details: 'user_id 형식이 올바르지 않습니다.',
          hint: '다시 로그인해주세요.'
        },
        { status: 400 }
      )
    }

    console.log(`📝 [${requestId}] 삽입 시도:`, { 
      user_id: user.id, 
      user_email: user.email,
      category, 
      notes,
      has_intensity_metrics: !!intensity_metrics,
      weight_kg: weightKg,
      reps: repsValue,
      sets: setsValue,
      logged_at: logged_at || new Date().toISOString()
    })

    // 📦 INSERT 데이터 객체 생성 (user_id 필수 포함)
    // notes 필드명으로 통일하여 저장 (note 필드는 제거, notes만 사용)
    
    // weight_kg, reps, sets 최종 변환 및 검증 (DB 타입: numeric, integer)
    // 빈 문자열("")은 null로, 유효한 숫자는 Number()로 변환
    const finalWeightKg = (weightKg !== null && !isNaN(Number(weightKg)) && Number(weightKg) > 0) 
      ? Number(weightKg) 
      : null
    const finalReps = (repsValue !== null && !isNaN(Number(repsValue)) && Number(repsValue) > 0) 
      ? Number(repsValue) 
      : null
    const finalSets = (setsValue !== null && !isNaN(Number(setsValue)) && Number(setsValue) > 0) 
      ? Number(setsValue) 
      : null
    
    const insertData: any = {
      user_id: user.id, // ⚠️ 반드시 포함!
      category,
      notes: notes, // notes 필드명으로 통일
      logged_at: logged_at || new Date().toISOString(),
      ...(sub_type && { sub_type }),
      ...(quantity !== undefined && quantity !== null && { quantity }),
      ...(unit && { unit }),
      // 식사 관련 필드
      ...(meal_description && { meal_description }),
      ...(image_url && { image_url }),
      // 운동 관련 필드 - 모든 정보가 누락 없이 포함되도록 보장
      ...(exercise_type && { exercise_type }),
      ...(duration_minutes !== undefined && duration_minutes !== null && { duration_minutes }),
      ...(heart_rate !== undefined && heart_rate !== null && { heart_rate }),
      // 무게, 횟수, 세트를 직접 컬럼으로 저장 (DB 타입: numeric, integer)
      // 값이 없으면 null, 있으면 반드시 숫자 타입으로 보장
      weight_kg: finalWeightKg,
      reps: finalReps,
      sets: finalSets,
      // intensity_metrics는 반드시 포함 (운동 카테고리일 때)
      ...(category === 'exercise' && intensity_metrics && { intensity_metrics }),
      // 복약 관련 필드
      ...(medication_name && { medication_name }),
      ...(medication_dosage && { medication_dosage }),
      ...(medication_ingredients && { medication_ingredients })
    }
    
    // schedule_id는 현재 스키마에 없으므로 제외
    if (schedule_id) {
      console.warn(`⚠️ [${requestId}] schedule_id는 현재 스키마에 없어 무시됩니다:`, schedule_id)
    }

    // 🔍 INSERT 전 최종 검증
    if (!insertData.user_id) {
      console.error(`❌ [${requestId}] user_id 누락:`, insertData)
      return NextResponse.json(
        { 
          success: false, 
          error: 'user_id가 누락되었습니다.',
          details: '시스템 오류입니다. 관리자에게 문의해주세요.',
          requestId: requestId
        },
        { status: 500 }
      )
    }
    
    // 🔍 weight_kg, reps, sets 타입 검증 (DB 타입과 일치하는지 확인)
    if (insertData.weight_kg !== null && (typeof insertData.weight_kg !== 'number' || isNaN(insertData.weight_kg))) {
      console.error(`❌ [${requestId}] weight_kg 타입 오류:`, {
        value: insertData.weight_kg,
        type: typeof insertData.weight_kg,
        isNaN: isNaN(insertData.weight_kg)
      })
      return NextResponse.json(
        { 
          success: false, 
          error: 'weight_kg 값이 올바르지 않습니다.',
          details: `weight_kg는 숫자 타입이어야 합니다. (현재: ${typeof insertData.weight_kg})`,
          requestId: requestId
        },
        { status: 400 }
      )
    }
    if (insertData.reps !== null && (typeof insertData.reps !== 'number' || isNaN(insertData.reps))) {
      console.error(`❌ [${requestId}] reps 타입 오류:`, {
        value: insertData.reps,
        type: typeof insertData.reps,
        isNaN: isNaN(insertData.reps)
      })
      return NextResponse.json(
        { 
          success: false, 
          error: 'reps 값이 올바르지 않습니다.',
          details: `reps는 숫자 타입이어야 합니다. (현재: ${typeof insertData.reps})`,
          requestId: requestId
        },
        { status: 400 }
      )
    }
    if (insertData.sets !== null && (typeof insertData.sets !== 'number' || isNaN(insertData.sets))) {
      console.error(`❌ [${requestId}] sets 타입 오류:`, {
        value: insertData.sets,
        type: typeof insertData.sets,
        isNaN: isNaN(insertData.sets)
      })
      return NextResponse.json(
        { 
          success: false, 
          error: 'sets 값이 올바르지 않습니다.',
          details: `sets는 숫자 타입이어야 합니다. (현재: ${typeof insertData.sets})`,
          requestId: requestId
        },
        { status: 400 }
      )
    }

    // 🔍 INSERT 전 최종 데이터 검증 및 로깅
    console.log(`💾 [${requestId}] 데이터베이스에 삽입 시도...`)
    console.log(`📋 [${requestId}] 최종 insertData 검증:`, {
      weight_kg: { value: insertData.weight_kg, type: typeof insertData.weight_kg, isNull: insertData.weight_kg === null },
      reps: { value: insertData.reps, type: typeof insertData.reps, isNull: insertData.reps === null },
      sets: { value: insertData.sets, type: typeof insertData.sets, isNull: insertData.sets === null },
      intensity_metrics: insertData.intensity_metrics ? '있음' : '없음',
      category: insertData.category
    })

    const { data, error } = await supabase
      .from('health_logs')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      // 🔍 Supabase 에러 상세 정보 로깅 (message, hint, details 모두 포함)
      const errorDetails = {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        insertData: insertData
      }
      
      console.error(`\n${'='.repeat(70)}`)
      console.error(`❌ [${requestId}] Supabase 삽입 에러 발생`)
      console.error(`${'='.repeat(70)}`)
      console.error('📌 에러 코드:', error.code || 'N/A')
      console.error('📌 에러 메시지:', error.message || 'N/A')
      console.error('📌 에러 상세 (details):', error.details || 'N/A')
      console.error('📌 에러 힌트 (hint):', error.hint || 'N/A')
      console.error('📌 전체 에러 객체:', JSON.stringify(error, null, 2))
      console.error('📌 삽입 시도 데이터:', JSON.stringify(insertData, null, 2))
      console.error('📌 데이터 타입 확인:', {
        weight_kg: { value: insertData.weight_kg, type: typeof insertData.weight_kg },
        reps: { value: insertData.reps, type: typeof insertData.reps },
        sets: { value: insertData.sets, type: typeof insertData.sets }
      })
      console.error(`${'='.repeat(70)}\n`)
      
      // RLS 정책 관련 에러 (42501 = insufficient_privilege)
      if (error.code === '42501' || error.message?.includes('RLS') || error.message?.includes('policy') || error.message?.includes('permission') || error.message?.includes('row-level security')) {
        // 쿠키 정보 가져오기
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        
        console.error('🔒 [Health Logs] RLS 정책 위반:', {
          error_code: error.code,
          error_message: error.message,
          user_id: user.id,
          insert_data: insertData,
          cookies: allCookies.map(c => c.name)
        })
        
        return NextResponse.json({
          success: false,
          error: 'RLS 정책 오류: 데이터 저장 권한이 없습니다.',
          details: error.message,
          hint: 'Supabase SQL Editor에서 supabase/fix-rls-policies.sql 파일을 실행하여 RLS 정책을 재생성해주세요.',
          code: error.code,
          debug: {
            user_id: user.id,
            has_user_id: !!insertData.user_id,
            user_id_type: typeof insertData.user_id,
            cookie_count: allCookies.length
          },
          solution: '1. Supabase SQL Editor 열기\n2. supabase/fix-rls-policies.sql 실행\n3. 페이지 새로고침 후 다시 시도'
        }, { status: 403 })
      }
      
      // PGRST204 에러: PostgREST 스키마 캐시 문제 (컬럼이 실제로는 있지만 캐시에 없음)
      if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('Could not find')) {
        const columnMatch = error.message.match(/column ['"](\w+)['"]/)
        const missingColumn = columnMatch?.[1] || '알 수 없음'
        
        console.error(`🔄 [${requestId}] PostgREST 스키마 캐시 문제 감지:`, {
          column: missingColumn,
          error_code: error.code,
          error_message: error.message
        })
        
        // exercise_type, weight_kg, reps, sets 등 운동 관련 컬럼
        const exerciseColumns = ['exercise_type', 'weight_kg', 'reps', 'sets', 'duration_minutes', 'heart_rate']
        
        if (exerciseColumns.includes(missingColumn)) {
          return NextResponse.json({
            success: false,
            error: `스키마 캐시 문제: '${missingColumn}' 컬럼을 찾을 수 없습니다.`,
            details: error.message,
            hint: `PostgREST 스키마 캐시가 업데이트되지 않았습니다. 다음 단계를 따라주세요:`,
            code: error.code,
            requestId: requestId,
            solution: `1. Supabase 대시보드 → SQL Editor 열기\n2. supabase/health-logs-alter-add-columns.sql 파일 내용 복사하여 실행\n3. Supabase 대시보드에서 "Reload schema" 또는 API 재시작\n4. 1-2분 대기 후 페이지 새로고침하여 다시 시도`,
            troubleshooting: `컬럼이 이미 추가되어 있다면:\n- Supabase 대시보드 → Settings → API → "Reload schema" 클릭\n- 또는 Supabase 프로젝트를 재시작하면 자동으로 스키마 캐시가 갱신됩니다.`
          }, { status: 500 })
        }
        
        return NextResponse.json({
          success: false,
          error: `스키마 캐시 문제: '${missingColumn}' 컬럼을 찾을 수 없습니다.`,
          details: error.message,
          hint: 'PostgREST 스키마 캐시가 업데이트되지 않았습니다. Supabase 대시보드에서 스키마를 다시 로드해주세요.',
          code: error.code,
          requestId: requestId
        }, { status: 500 })
      }
      
      // 테이블 없음 에러
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return NextResponse.json({
          success: false,
          error: 'health_logs 테이블이 존재하지 않습니다.',
          details: error.message,
          hint: 'supabase/schema-v2.sql 파일의 CREATE TABLE SQL을 먼저 실행해주세요.',
          code: error.code,
          requestId: requestId
        }, { status: 500 })
      }
      
      // 컬럼 없음 에러 (weight_kg, reps, sets 등)
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        const columnMatch = error.message.match(/column ['"](\w+)['"]/)
        const missingColumn = columnMatch?.[1] || '알 수 없음'
        
        // 운동 관련 컬럼 목록
        const exerciseColumns = ['exercise_type', 'weight_kg', 'reps', 'sets', 'duration_minutes', 'heart_rate', 'intensity_metrics', 'notes']
        
        if (exerciseColumns.includes(missingColumn)) {
          return NextResponse.json({
            success: false,
            error: `존재하지 않는 컬럼: ${missingColumn}`,
            details: error.message,
            hint: `health_logs 테이블에 '${missingColumn}' 컬럼이 없습니다. Supabase SQL Editor에서 'supabase/health-logs-alter-add-columns.sql' 파일을 실행해주세요.`,
            code: error.code,
            requestId: requestId,
            solution: `1. Supabase 대시보드 → SQL Editor 열기\n2. supabase/health-logs-alter-add-columns.sql 파일 내용 복사\n3. 실행하여 컬럼 추가\n4. 페이지 새로고침 후 다시 시도`
          }, { status: 400 })
        }
        
        return NextResponse.json({
          success: false,
          error: `존재하지 않는 컬럼: ${missingColumn}`,
          details: error.message,
          hint: `health_logs 테이블에 '${missingColumn}' 컬럼이 없습니다. 스키마를 확인해주세요.`,
          code: error.code,
          requestId: requestId
        }, { status: 400 })
      }
      
      // 모든 에러에 상세 정보 포함
      return NextResponse.json({
        success: false,
        error: '기록 저장 중 오류가 발생했습니다.',
        details: error.message || '알 수 없는 오류',
        code: error.code || 'UNKNOWN',
        hint: error.hint || 'Supabase 로그를 확인하세요.',
        requestId: requestId,
        debug: errorDetails
      }, { status: 500 })
    }

    console.log(`✅ [${requestId}] ${categoryLabels[category as CategoryType]} 기록 완료:`, {
      id: data.id,
      user_id: user.id,
      logged_at: data.logged_at
    })

    return NextResponse.json({
      success: true,
      message: `${categoryLabels[category as CategoryType]} 기록이 완료되었습니다.`,
      data
    })

  } catch (error: any) {
    console.error(`\n${'='.repeat(70)}`)
    console.error(`❌ [Health Logs] POST 서버 에러 (ID: ${requestId})`)
    console.error(`${'='.repeat(70)}`)
    console.error('📌 에러 타입:', typeof error)
    console.error('📌 에러 이름:', error?.name || 'N/A')
    console.error('📌 에러 메시지:', error?.message || 'N/A')
    console.error('📌 에러 스택:', error?.stack?.split('\n').slice(0, 15).join('\n') || 'N/A')
    
    // Supabase 에러인 경우 상세 정보 로깅
    if (error?.code || error?.message?.includes('Supabase') || error?.message?.includes('Postgrest')) {
      console.error('📌 Supabase 관련 에러 감지:')
      console.error('   - code:', error.code || 'N/A')
      console.error('   - message:', error.message || 'N/A')
      console.error('   - details:', error.details || 'N/A')
      console.error('   - hint:', error.hint || 'N/A')
      console.error('   - 전체 에러 객체:', JSON.stringify(error, null, 2))
    }
    
    // 에러가 Error 객체인지 확인
    if (error instanceof Error) {
      console.error('📌 Error 객체 상세:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause
      })
    } else {
      console.error('📌 원본 에러 객체:', JSON.stringify(error, null, 2))
    }
    
    console.error(`${'='.repeat(70)}\n`)
    
    return NextResponse.json(
      { 
        success: false, 
        error: '서버 오류가 발생했습니다.',
        details: error?.message || String(error),
        code: error?.code || 'UNKNOWN',
        hint: error?.hint || 'Vercel 로그에서 requestId로 검색하여 상세 에러를 확인하세요.',
        requestId: requestId
      },
      { status: 500 }
    )
  }
}

// ========================
// GET: 건강 로그 조회
// ========================
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const category = searchParams.get('category')

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 쿼리 빌더
    let query = supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })

    // 날짜 필터
    if (startDate) {
      query = query.gte('logged_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('logged_at', `${endDate}T23:59:59`)
    }
    
    // 카테고리 필터
    if (category && ['meal', 'exercise', 'medication'].includes(category)) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ [Health Logs] 조회 에러:', error)
      
      // 테이블 없음 에러
      if (error.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'health_logs 테이블이 존재하지 않습니다.',
          hint: 'supabase/schema-v2.sql 파일을 실행해주세요.',
          data: [],
          todayStats: { meal: 0, exercise: 0, medication: 0 }
        })
      }
      
      return NextResponse.json(
        { success: false, error: '기록 조회 중 오류가 발생했습니다.', data: [], todayStats: { meal: 0, exercise: 0, medication: 0 } },
        { status: 500 }
      )
    }

    // 오늘 날짜 기준 통계 계산
    const today = new Date().toISOString().split('T')[0]
    const todayLogs = data?.filter(log => 
      log.logged_at.startsWith(today)
    ) || []

    const todayStats = {
      meal: todayLogs.filter(l => l.category === 'meal').length,
      exercise: todayLogs.filter(l => l.category === 'exercise').length,
      medication: todayLogs.filter(l => l.category === 'medication').length,
    }

    return NextResponse.json({
      success: true,
      data,
      todayStats,
      total: data?.length || 0
    })

  } catch (error) {
    console.error('❌ [Health Logs] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.', data: [], todayStats: { meal: 0, exercise: 0, medication: 0 } },
      { status: 500 }
    )
  }
}

// ========================
// DELETE: 건강 로그 삭제
// ========================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const logId = searchParams.get('id')

    if (!logId) {
      return NextResponse.json(
        { success: false, error: '삭제할 기록 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from('health_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ [Health Logs] 삭제 에러:', error)
      return NextResponse.json(
        { success: false, error: '기록 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '기록이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('❌ [Health Logs] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
