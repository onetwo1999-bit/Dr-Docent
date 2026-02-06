/**
 * 그룹 캘린더 API
 * - 수치·몸무게·키 등 민감 데이터는 절대 포함하지 않음. 활동 여부(날짜+카테고리)만 반환.
 */

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

/** RPC 결과를 날짜별 meal/exercise/medication 여부로 집계 */
function aggregateDays(rows: { activity_date: string; category: string }[]): Record<string, { meal: boolean; exercise: boolean; medication: boolean }> {
  const days: Record<string, { meal: boolean; exercise: boolean; medication: boolean }> = {}
  for (const row of rows) {
    const dateStr = typeof row.activity_date === 'string' ? row.activity_date.slice(0, 10) : ''
    if (!dateStr) continue
    if (!days[dateStr]) {
      days[dateStr] = { meal: false, exercise: false, medication: false }
    }
    if (row.category === 'meal') days[dateStr].meal = true
    else if (row.category === 'exercise') days[dateStr].exercise = true
    else if (row.category === 'medication') days[dateStr].medication = true
  }
  return days
}

/** 활동 요약 문구 생성 (AI 스타일, 수치형 민감 데이터 없음) */
function buildActivitySummary(days: Record<string, { meal: boolean; exercise: boolean; medication: boolean }>): string {
  const dates = Object.keys(days).sort()
  if (dates.length === 0) {
    return '아직 그룹 활동 기록이 없어요. 첫 기록을 남겨보세요.'
  }
  let mealDays = 0
  let exerciseDays = 0
  let medicationDays = 0
  for (const d of dates) {
    if (days[d].meal) mealDays += 1
    if (days[d].exercise) exerciseDays += 1
    if (days[d].medication) medicationDays += 1
  }
  const totalDays = dates.length
  const parts: string[] = []
  if (mealDays > 0) parts.push(`식단 ${mealDays}일`)
  if (exerciseDays > 0) parts.push(`운동 ${exerciseDays}일`)
  if (medicationDays > 0) parts.push(`복약 ${medicationDays}일`)
  if (parts.length === 0) return '이번 기간에는 활동 기록이 없었어요.'
  return `이번 기간 그룹은 ${parts.join(', ')} 기록했어요. 함께 꾸준히 챙기고 있어요.`
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('group_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!groupId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'group_id, start_date, end_date가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { data: rows, error } = await supabase.rpc('get_group_calendar_activity', {
      p_group_id: groupId,
      p_start_date: startDate,
      p_end_date: endDate,
    })

    if (error) {
      if (error.code === '42883') {
        return NextResponse.json(
          { success: false, error: '그룹 캘린더 함수가 없습니다. supabase/group-calendar-realtime.sql을 실행해주세요.' },
          { status: 503 }
        )
      }
      console.error('[Group Calendar] RPC error:', error)
      return NextResponse.json(
        { success: false, error: '그룹 활동 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const list = (rows || []) as { activity_date: string; category: string }[]
    const days = aggregateDays(list)
    const summary = buildActivitySummary(days)

    return NextResponse.json({
      success: true,
      days,
      summary,
    })
  } catch (e) {
    console.error('[Group Calendar] error:', e)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
