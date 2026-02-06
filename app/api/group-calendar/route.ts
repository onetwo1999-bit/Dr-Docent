/**
 * 그룹 캘린더 API (프라이버시 우선)
 * - 키, 몸무게, 구체적인 약 이름 등 민감 정보는 응답에서 철저히 차단.
 * - 반환: 날짜별 기록 여부(meal/exercise/medication)와 요약 문구만. 수치 데이터 없음.
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

/** 활동 요약 (숫자만, 민감 데이터 없음) */
function buildActivitySummary(days: Record<string, { meal: boolean; exercise: boolean; medication: boolean }>): string {
  const dates = Object.keys(days).sort()
  if (dates.length === 0) return '아직 그룹 활동 기록이 없어요. 첫 기록을 남겨보세요.'
  let mealDays = 0
  let exerciseDays = 0
  let medicationDays = 0
  for (const d of dates) {
    if (days[d].meal) mealDays += 1
    if (days[d].exercise) exerciseDays += 1
    if (days[d].medication) medicationDays += 1
  }
  const parts: string[] = []
  if (mealDays > 0) parts.push(`식단 ${mealDays}일`)
  if (exerciseDays > 0) parts.push(`운동 ${exerciseDays}일`)
  if (medicationDays > 0) parts.push(`복약 ${medicationDays}일`)
  if (parts.length === 0) return '이번 기간에는 활동 기록이 없었어요.'
  return `이번 기간 그룹은 ${parts.join(', ')} 기록했어요. 함께 꾸준히 챙기고 있어요.`
}

/** 닥터 도슨트의 그룹 건강 요약 (따뜻한 문체, 수치/민감 정보 없음) */
function buildGroupHealthBriefing(days: Record<string, { meal: boolean; exercise: boolean; medication: boolean }>): string {
  const dates = Object.keys(days).sort()
  if (dates.length === 0) {
    return '아직 그룹의 건강 기록이 없어요. 누군가 첫 기록을 남기면 여기에 따뜻한 요약이 써질 거예요. 함께 시작해 보아요.'
  }
  let mealDays = 0
  let exerciseDays = 0
  let medicationDays = 0
  for (const d of dates) {
    if (days[d].meal) mealDays += 1
    if (days[d].exercise) exerciseDays += 1
    if (days[d].medication) medicationDays += 1
  }
  const hasMeal = mealDays > 0
  const hasExercise = exerciseDays > 0
  const hasMedication = medicationDays > 0
  if (!hasMeal && !hasExercise && !hasMedication) {
    return '이번 달에는 아직 기록된 활동이 없어요. 조금만 챙겨도 다음엔 분명 더 풍성한 요약이 함께할 거예요.'
  }
  const lines: string[] = []
  if (hasMeal) lines.push('식단을 꾸준히 기록하고 계세요.')
  if (hasExercise) lines.push('운동도 함께 챙기고 있어요.')
  if (hasMedication) lines.push('복약까지 놓치지 않고 잘 관리하고 계세요.')
  const first = lines.slice(0, -1).join(' ')
  const last = lines[lines.length - 1]
  const intro = '이번 달 그룹 건강 요약이에요.'
  const body = lines.length > 1 ? `${first} ${last}` : last
  return `${intro} ${body} 작은 습관이 모여 더 건강한 일상을 만들어 가고 있어요. 계속 응원할게요.`
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
    const ai_briefing = buildGroupHealthBriefing(days)

    // 응답은 오직 아래 필드만 반환 (키·몸무게·약 이름 등 민감 정보 절대 미포함)
    const body: {
      success: true
      days: Record<string, { meal: boolean; exercise: boolean; medication: boolean }>
      summary: string
      ai_briefing: string
    } = {
      success: true,
      days,
      summary,
      ai_briefing,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.error('[Group Calendar] error:', e)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
