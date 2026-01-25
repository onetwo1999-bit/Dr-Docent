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

// Supabase 클라이언트 생성
async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// ========================
// POST: 건강 로그 추가
// ========================
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { category, note, logged_at, sub_type, quantity, unit, schedule_id } = body

    // 유효성 검사
    if (!category || !['meal', 'exercise', 'medication'].includes(category)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 카테고리입니다.' },
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

    console.log('📝 [Health Logs] 삽입 시도:', { 
      user_id: user.id, 
      category, 
      note,
      logged_at: logged_at || new Date().toISOString()
    })

    // 로그 삽입
    const { data, error } = await supabase
      .from('health_logs')
      .insert({
        user_id: user.id,
        category,
        note: note || null,
        logged_at: logged_at || new Date().toISOString(),
        sub_type: sub_type || null,
        quantity: quantity || null,
        unit: unit || null,
        schedule_id: schedule_id || null
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [Health Logs] 삽입 에러:', error)
      console.error('   - 코드:', error.code)
      console.error('   - 메시지:', error.message)
      console.error('   - 상세:', error.details)
      console.error('   - 힌트:', error.hint)
      
      // RLS 정책 관련 에러
      if (error.code === '42501' || error.message?.includes('RLS') || error.message?.includes('policy')) {
        return NextResponse.json({
          success: false,
          error: 'RLS 정책 오류: Supabase에서 health_logs 테이블의 RLS 정책을 확인해주세요.',
          details: error.message,
          hint: 'supabase/schema-v2.sql 파일의 RLS 정책 SQL을 실행해주세요.',
          code: error.code
        }, { status: 403 })
      }
      
      // 테이블 없음 에러
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'health_logs 테이블이 존재하지 않습니다.',
          details: error.message,
          hint: 'supabase/schema-v2.sql 파일의 CREATE TABLE SQL을 먼저 실행해주세요.',
          code: error.code
        }, { status: 500 })
      }
      
      return NextResponse.json(
        { success: false, error: '기록 저장 중 오류가 발생했습니다.', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    console.log(`✅ [Health Logs] ${categoryLabels[category as CategoryType]} 기록 완료:`, {
      id: data.id,
      user_id: user.id,
      logged_at: data.logged_at
    })

    return NextResponse.json({
      success: true,
      message: `${categoryLabels[category as CategoryType]} 기록이 완료되었습니다.`,
      data
    })

  } catch (error) {
    console.error('❌ [Health Logs] 서버 에러:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
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
