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
    const { target_user_id, score, date } = body

    if (!target_user_id || score === undefined || !date) {
      return NextResponse.json(
        { success: false, error: 'target_user_id, score, date가 필요합니다.' },
        { status: 400 }
      )
    }

    // 점수 범위 확인
    if (score < 0 || score > 10) {
      return NextResponse.json(
        { success: false, error: '점수는 0-10 사이여야 합니다.' },
        { status: 400 }
      )
    }

    // 대상 사용자의 chart_number 조회
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('chart_number')
      .eq('id', target_user_id)
      .single()

    if (targetError || !targetProfile?.chart_number) {
      return NextResponse.json(
        { success: false, error: '대상 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // health_scores에 점수 설정 (upsert)
    const { error: scoreError } = await supabase
      .from('health_scores')
      .upsert(
        {
          chart_number: targetProfile.chart_number,
          score_date: date,
          score: score
        },
        { onConflict: 'chart_number,score_date' }
      )

    if (scoreError) {
      console.error('[Admin] 점수 조작 에러:', scoreError)
      return NextResponse.json(
        { success: false, error: '점수 설정에 실패했습니다.', details: scoreError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `점수가 ${score}점으로 설정되었습니다.`,
      data: {
        target_user_id,
        chart_number: targetProfile.chart_number,
        date,
        score
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
