import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 🌸 Cycle Logs API (그날 케어)
// 여성 건강 주기 기록 및 예측
// ========================

// Route Handler용 클라이언트 생성 (profile API와 동일한 방식)
async function createClient() {
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
// 📊 주기 예측 알고리즘
// ========================
function calculateCyclePrediction(cycles: { start_date: string; cycle_length: number | null }[]) {
  // 최근 3개월(또는 최대 6개) 데이터 사용
  const recentCycles = cycles
    .filter(c => c.cycle_length && c.cycle_length > 0)
    .slice(0, 6)

  if (recentCycles.length === 0) {
    // 데이터가 없으면 기본 28일 주기 사용
    return {
      averageCycleLength: 28,
      predictedNextDate: null,
      confidence: 'low',
      dataPoints: 0
    }
  }

  // 평균 주기 계산
  const totalDays = recentCycles.reduce((sum, c) => sum + (c.cycle_length || 28), 0)
  const averageCycleLength = Math.round(totalDays / recentCycles.length)

  // 마지막 시작일로부터 예측
  const lastStartDate = new Date(cycles[0].start_date)
  const predictedNextDate = new Date(lastStartDate)
  predictedNextDate.setDate(predictedNextDate.getDate() + averageCycleLength)

  // 신뢰도 계산 (데이터 포인트가 많을수록 높음)
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (recentCycles.length >= 6) confidence = 'high'
  else if (recentCycles.length >= 3) confidence = 'medium'

  return {
    averageCycleLength,
    predictedNextDate: predictedNextDate.toISOString().split('T')[0],
    confidence,
    dataPoints: recentCycles.length
  }
}

// ========================
// 🚨 지연 알림 필요 여부 확인
// ========================
function checkIfLate(predictedDate: string | null, lastStartDate: string): {
  isLate: boolean
  daysLate: number
} {
  if (!predictedDate) {
    return { isLate: false, daysLate: 0 }
  }

  const today = new Date()
  const predicted = new Date(predictedDate)
  const diffTime = today.getTime() - predicted.getTime()
  const daysLate = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  return {
    isLate: daysLate >= 3,
    daysLate: Math.max(0, daysLate)
  }
}

// ========================
// POST: 그날 기록 추가/수정
// ========================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { start_date, end_date, note, action } = body

    // action: 'start' (그날 시작), 'end' (그날 종료), 'update' (수정)

    const supabase = await createClient()
    
    // 인증 확인 (상세 로깅)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('❌ [Cycle Logs] POST 인증 에러:', authError)
      return NextResponse.json(
        { 
          success: false,
          error: '로그인이 필요합니다.',
          details: authError.message || '인증 세션이 유효하지 않습니다.',
          hint: '페이지를 새로고침하거나 다시 로그인해주세요.'
        },
        { status: 401 }
      )
    }
    
    if (!user || !user.id) {
      console.error('❌ [Cycle Logs] POST 유저 정보 없음')
      return NextResponse.json(
        { 
          success: false,
          error: '로그인이 필요합니다.',
          details: '유저 세션이 만료되었거나 유효하지 않습니다.'
        },
        { status: 401 }
      )
    }

    if (action === 'start') {
      // 그날 시작 기록
      if (!start_date) {
        return NextResponse.json(
          { 
            success: false,
            error: '시작일을 입력해주세요.',
            details: 'start_date 파라미터가 필요합니다.'
          },
          { status: 400 }
        )
      }

      // 이전 주기 길이 계산 (이전 기록이 있는 경우)
      const { data: previousCycle } = await supabase
        .from('cycle_logs')
        .select('start_date')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      let cycle_length = null
      if (previousCycle) {
        const prevDate = new Date(previousCycle.start_date)
        const newDate = new Date(start_date)
        cycle_length = Math.round((newDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      }

      const { data, error } = await supabase
        .from('cycle_logs')
        .insert({
          user_id: user.id,
          start_date,
          cycle_length,
          note: note || null
        })
        .select()
        .single()

      if (error) {
        console.error('❌ [Cycle Logs] 시작 기록 에러:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // 테이블이 없는 경우
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
          return NextResponse.json({
            success: false,
            error: '데이터베이스 테이블을 찾을 수 없습니다.',
            details: error.message || 'cycle_logs 테이블이 존재하지 않습니다.',
            hint: 'Supabase SQL Editor에서 schema-v2.sql을 실행하여 테이블을 생성해주세요.'
          }, { status: 500 })
        }
        
        // RLS 정책 에러
        if (error.code === '42501' || error.message?.includes('RLS') || error.message?.includes('policy')) {
          return NextResponse.json({
            success: false,
            error: 'RLS 정책 오류: 데이터 저장 권한이 없습니다.',
            details: error.message,
            hint: 'Supabase SQL Editor에서 cycle_logs 테이블의 RLS 정책을 확인해주세요.'
          }, { status: 403 })
        }
        
        return NextResponse.json(
          { 
            success: false, 
            error: '기록 저장 중 오류가 발생했습니다.', 
            details: error.message,
            hint: error.hint || '데이터베이스 연결을 확인해주세요.'
          },
          { status: 500 }
        )
      }

      console.log('✅ [Cycle Logs] 그날 시작 기록:', user.email)

      // 예측 알림 자동 등록 (1~2회 데이터 기반)
      const { data: allCycles } = await supabase
        .from('cycle_logs')
        .select('start_date, cycle_length')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(6)

      if (allCycles && allCycles.length >= 1) {
        const prediction = calculateCyclePrediction(allCycles)
        
        if (prediction.predictedNextDate && prediction.dataPoints >= 1) {
          // schedules 테이블에 예측 알림 등록
          const { error: scheduleError } = await supabase
            .from('schedules')
            .upsert({
              user_id: user.id,
              category: 'cycle',
              sub_type: 'reminder',
              title: '그날 예정일 알림',
              frequency: 'monthly',
              scheduled_time: '09:00',
              day_of_month: new Date(prediction.predictedNextDate).getDate(),
              is_active: true,
              notification_enabled: true
            }, {
              onConflict: 'user_id,category,sub_type'
            })

          if (scheduleError) {
            console.warn('⚠️ [Cycle Logs] 예측 알림 등록 실패:', scheduleError)
          } else {
            console.log('✅ [Cycle Logs] 예측 알림 등록 완료:', prediction.predictedNextDate)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: '그날 시작이 기록되었습니다.',
        data
      }, { status: 200 })

    } else if (action === 'end') {
      // 그날 종료 기록 (최근 기록에 종료일 추가)
      if (!end_date) {
        return NextResponse.json(
          { 
            success: false,
            error: '종료일을 입력해주세요.',
            details: 'end_date 파라미터가 필요합니다.'
          },
          { status: 400 }
        )
      }

      // 먼저 종료일이 null인 최근 레코드를 찾기 (maybeSingle 사용 - 레코드가 없어도 에러 발생 안 함)
      const { data: currentCycle, error: findError } = await supabase
        .from('cycle_logs')
        .select('id')
        .eq('user_id', user.id)
        .is('end_date', null)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      // PGRST205 에러는 레코드가 없다는 의미이므로 정상 처리
      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ [Cycle Logs] 종료할 레코드 조회 중 에러:', {
          code: findError.code,
          message: findError.message,
          details: findError.details,
          hint: findError.hint
        })
        return NextResponse.json(
          { 
            success: false, 
            error: '레코드 조회 중 오류가 발생했습니다.',
            details: findError.message || '데이터베이스 조회 실패',
            hint: findError.hint || '테이블이 존재하는지 확인해주세요.'
          },
          { status: 500 }
        )
      }

      if (!currentCycle || !currentCycle.id) {
        console.log('ℹ️ [Cycle Logs] 종료할 진행 중인 기록이 없음')
        return NextResponse.json(
          { 
            success: false, 
            error: '종료할 진행 중인 기록을 찾을 수 없습니다.',
            details: '진행 중인 그날 기록이 없습니다. 먼저 "그날 시작" 버튼을 눌러주세요.'
          },
          { status: 404 }
        )
      }

      // 찾은 레코드의 ID로 업데이트
      const { data, error } = await supabase
        .from('cycle_logs')
        .update({
          end_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentCycle.id)
        .select()
        .single()

      if (error) {
        console.error('❌ [Cycle Logs] 종료 기록 에러:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        
        // 테이블이 없는 경우
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
          return NextResponse.json({
            success: false,
            error: '데이터베이스 테이블을 찾을 수 없습니다.',
            details: error.message || 'cycle_logs 테이블이 존재하지 않습니다.',
            hint: 'Supabase SQL Editor에서 schema-v2.sql을 실행하여 테이블을 생성해주세요.'
          }, { status: 500 })
        }
        
        // RLS 정책 에러
        if (error.code === '42501' || error.message?.includes('RLS') || error.message?.includes('policy')) {
          return NextResponse.json({
            success: false,
            error: 'RLS 정책 오류: 데이터 저장 권한이 없습니다.',
            details: error.message,
            hint: 'Supabase SQL Editor에서 cycle_logs 테이블의 RLS 정책을 확인해주세요.'
          }, { status: 403 })
        }
        
        return NextResponse.json(
          { 
            success: false, 
            error: '종료 기록 중 오류가 발생했습니다.', 
            details: error.message,
            hint: error.hint || '데이터베이스 연결을 확인해주세요.'
          },
          { status: 500 }
        )
      }

      console.log('✅ [Cycle Logs] 그날 종료 기록:', user.email)

      return NextResponse.json({
        success: true,
        message: '그날 종료가 기록되었습니다.',
        data
      }, { status: 200 })
    }

    return NextResponse.json(
      { 
        success: false,
        error: '유효하지 않은 요청입니다.',
        details: 'action 파라미터가 올바르지 않습니다.'
      },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('❌ [Cycle Logs] 서버 에러:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '서버 오류가 발생했습니다.',
        details: error?.message || '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}

// ========================
// GET: 주기 기록 및 예측 조회
// ========================
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    
    // 인증 확인 (상세 로깅)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('❌ [Cycle Logs] GET 인증 에러:', authError)
      return NextResponse.json(
        { 
          success: false,
          error: '로그인이 필요합니다.',
          details: authError.message || '인증 세션이 유효하지 않습니다.'
        },
        { status: 401 }
      )
    }
    
    if (!user || !user.id) {
      return NextResponse.json(
        { 
          success: false,
          error: '로그인이 필요합니다.',
          details: '유저 세션이 만료되었거나 유효하지 않습니다.'
        },
        { status: 401 }
      )
    }

    // 최근 12개월 기록 조회
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const { data: cycles, error } = await supabase
      .from('cycle_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_date', oneYearAgo.toISOString().split('T')[0])
      .order('start_date', { ascending: false })

    if (error) {
      console.error('❌ [Cycle Logs] 조회 에러:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // 테이블이 없는 경우
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return NextResponse.json({
          success: false,
          error: '데이터베이스 테이블을 찾을 수 없습니다.',
          details: error.message || 'cycle_logs 테이블이 존재하지 않습니다.',
          hint: 'Supabase SQL Editor에서 schema-v2.sql을 실행하여 테이블을 생성해주세요.'
        }, { status: 500 })
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: '기록 조회 중 오류가 발생했습니다.',
          details: error.message,
          hint: error.hint || '데이터베이스 연결을 확인해주세요.'
        },
        { status: 500 }
      )
    }

    // 예측 계산
    const prediction = calculateCyclePrediction(cycles || [])

    // 지연 확인
    const lateStatus = cycles && cycles.length > 0
      ? checkIfLate(prediction.predictedNextDate, cycles[0].start_date)
      : { isLate: false, daysLate: 0 }

    // 현재 진행 중인 주기 (종료일이 없는 경우)
    const currentCycle = cycles?.find(c => !c.end_date) || null

    return NextResponse.json({
      success: true,
      data: {
        cycles: cycles || [],
        prediction,
        lateStatus,
        currentCycle,
        totalRecords: cycles?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ [Cycle Logs] 서버 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ========================
// DELETE: 기록 삭제
// ========================
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const logId = searchParams.get('id')

    if (!logId) {
      return NextResponse.json(
        { error: '삭제할 기록 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from('cycle_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id)

    if (error) {
      console.error('❌ [Cycle Logs] 삭제 에러:', error)
      return NextResponse.json(
        { error: '기록 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '기록이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('❌ [Cycle Logs] 서버 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
