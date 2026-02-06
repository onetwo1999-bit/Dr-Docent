import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function createClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  }
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options ?? {})
          )
        } catch {
          // Route Handler 제한
        }
      },
    },
  })
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 관리자 권한 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    // 요청 본문 파싱
    const body = await req.json()
    const { target_user_id, category, count } = body

    if (!target_user_id || !category || !count) {
      return NextResponse.json(
        { success: false, error: 'target_user_id, category, count가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!['meal', 'exercise', 'medication', 'sleep'].includes(category)) {
      return NextResponse.json(
        { success: false, error: 'category는 meal, exercise, medication, sleep 중 하나여야 합니다.' },
        { status: 400 }
      )
    }

    const countNum = parseInt(count)
    if (isNaN(countNum) || countNum < 1 || countNum > 30) {
      return NextResponse.json(
        { success: false, error: 'count는 1-30 사이의 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    // 대상 사용자 확인
    const { error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', target_user_id)
      .single()

    if (userError) {
      return NextResponse.json(
        { success: false, error: '대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 오늘 날짜로 가짜 로그 생성
    const today = new Date()
    const logs = []
    
    for (let i = 0; i < countNum; i++) {
      const loggedAt = new Date(today)
      loggedAt.setHours(Math.floor(Math.random() * 24))
      loggedAt.setMinutes(Math.floor(Math.random() * 60))

      const logData: any = {
        user_id: target_user_id,
        category,
        logged_at: loggedAt.toISOString()
      }

      // 카테고리별 추가 데이터
      if (category === 'meal') {
        logData.note = `테스트 식사 기록 ${i + 1}`
      } else if (category === 'exercise') {
        logData.exercise_type = ['걷기', '달리기', '자전거', '수영'][Math.floor(Math.random() * 4)]
        logData.duration_minutes = Math.floor(Math.random() * 60) + 10
      } else if (category === 'medication') {
        logData.medication_name = `테스트 약물 ${i + 1}`
      } else if (category === 'sleep') {
        logData.sleep_duration_hours = Math.floor(Math.random() * 8) + 6
      }

      logs.push(logData)
    }

    // 일괄 삽입
    const { data, error: insertError } = await supabase
      .from('health_logs')
      .insert(logs)
      .select()

    if (insertError) {
      console.error('[Admin] 가짜 로그 생성 에러:', insertError)
      return NextResponse.json(
        { success: false, error: '로그 생성에 실패했습니다.', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${countNum}개의 ${category} 로그가 생성되었습니다.`,
      data: {
        count: data?.length || 0,
        category,
        target_user_id
      }
    })
  } catch (error) {
    console.error('[Admin] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
