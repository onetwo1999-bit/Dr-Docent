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
    const { target_user_id, days } = body

    if (!target_user_id || !days) {
      return NextResponse.json(
        { success: false, error: 'target_user_id, days가 필요합니다.' },
        { status: 400 }
      )
    }

    const daysNum = parseInt(days)
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return NextResponse.json(
        { success: false, error: 'days는 1-30 사이의 숫자여야 합니다.' },
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

    // 과거 며칠치 로그 생성
    const today = new Date()
    const logs = []
    const categories = ['meal', 'exercise', 'medication', 'sleep']

    for (let dayOffset = 0; dayOffset < daysNum; dayOffset++) {
      const targetDate = new Date(today)
      targetDate.setDate(today.getDate() - dayOffset)

      // 각 날짜마다 랜덤하게 1-4개의 활동 생성
      const activityCount = Math.floor(Math.random() * 4) + 1
      const selectedCategories = categories
        .sort(() => Math.random() - 0.5)
        .slice(0, activityCount)

      for (const category of selectedCategories) {
        const loggedAt = new Date(targetDate)
        loggedAt.setHours(Math.floor(Math.random() * 24))
        loggedAt.setMinutes(Math.floor(Math.random() * 60))

        const logData: any = {
          user_id: target_user_id,
          category,
          logged_at: loggedAt.toISOString()
        }

        // 카테고리별 추가 데이터
        if (category === 'meal') {
          logData.note = `테스트 식사 기록 (${targetDate.toISOString().split('T')[0]})`
        } else if (category === 'exercise') {
          logData.exercise_type = ['걷기', '달리기', '자전거', '수영'][Math.floor(Math.random() * 4)]
          logData.duration_minutes = Math.floor(Math.random() * 60) + 10
        } else if (category === 'medication') {
          logData.medication_name = `테스트 약물`
        } else if (category === 'sleep') {
          logData.sleep_duration_hours = Math.floor(Math.random() * 3) + 6 // 6-9시간
        }

        logs.push(logData)
      }
    }

    // 일괄 삽입 (배치로 나눠서 삽입)
    const batchSize = 50
    let insertedCount = 0

    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize)
      const { error: insertError } = await supabase
        .from('health_logs')
        .insert(batch)

      if (insertError) {
        console.error('[Admin] 일괄 로그 생성 에러:', insertError)
        return NextResponse.json(
          { success: false, error: '로그 생성에 실패했습니다.', details: insertError.message },
          { status: 500 }
        )
      }
      insertedCount += batch.length
    }

    return NextResponse.json({
      success: true,
      message: `과거 ${daysNum}일치 ${insertedCount}개의 로그가 생성되었습니다.`,
      data: {
        days: daysNum,
        total_logs: insertedCount,
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
