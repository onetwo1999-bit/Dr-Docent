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

// ========================
// GET: 현재 포인트 조회
// ========================
export async function GET(req: Request) {
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

    // 사용자 포인트 조회
    const { data: points, error: pointsError } = await supabase
      .from('user_points')
      .select('daily_points, annual_points, last_updated_date')
      .eq('user_id', user.id)
      .single()

    if (pointsError && pointsError.code !== 'PGRST116') {
      console.error('[Points] 조회 에러:', pointsError)
      return NextResponse.json(
        { success: false, error: '포인트 조회에 실패했습니다.', details: pointsError.message },
        { status: 500 }
      )
    }

    // 레코드가 없으면 초기화
    if (!points) {
      const { data: newPoints, error: insertError } = await supabase
        .from('user_points')
        .insert({
          user_id: user.id,
          daily_points: 0,
          annual_points: 0,
          last_updated_date: new Date().toISOString().split('T')[0]
        })
        .select('daily_points, annual_points, last_updated_date')
        .single()

      if (insertError) {
        console.error('[Points] 초기화 에러:', insertError)
        return NextResponse.json(
          { success: false, error: '포인트 초기화에 실패했습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          daily_points: newPoints.daily_points || 0,
          annual_points: newPoints.annual_points || 0,
          last_updated_date: newPoints.last_updated_date,
          daily_remaining: 10 - (newPoints.daily_points || 0),
          annual_remaining: 3650 - (newPoints.annual_points || 0)
        }
      })
    }

    // 날짜 확인 (하루가 지나면 일일 포인트 리셋 필요)
    const today = new Date().toISOString().split('T')[0]
    const lastUpdated = points.last_updated_date

    let dailyPoints = points.daily_points || 0
    if (lastUpdated !== today) {
      // 날짜가 바뀌었으면 일일 포인트는 0으로 표시 (다음 활동 시 자동 리셋됨)
      dailyPoints = 0
    }

    return NextResponse.json({
      success: true,
      data: {
        daily_points: dailyPoints,
        annual_points: points.annual_points || 0,
        last_updated_date: points.last_updated_date,
        daily_remaining: 10 - dailyPoints,
        annual_remaining: 3650 - (points.annual_points || 0),
        daily_cap: 10,
        annual_cap: 3650
      }
    })
  } catch (error) {
    console.error('[Points] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
