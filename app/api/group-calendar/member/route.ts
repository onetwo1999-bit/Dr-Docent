/**
 * 개별 멤버 건강 로그 조회 API (프라이버시 우선)
 * - 특정 멤버의 건강 기록을 아이콘 형태로만 반환 (수치 데이터 없음)
 * - 타인의 캘린더를 볼 때는 수행 여부만 표시
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

/** 날짜별 meal/exercise/medication 여부로 집계 */
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

/** 개인화된 AI 코멘트 생성 */
function buildPersonalComment(
  memberNickname: string,
  days: Record<string, { meal: boolean; exercise: boolean; medication: boolean }>,
  isOwn: boolean
): string {
  const dates = Object.keys(days).sort()
  if (dates.length === 0) {
    return isOwn 
      ? '아직 건강 기록이 없어요. 첫 기록을 남겨보세요!'
      : `${memberNickname}님의 건강 기록이 아직 없어요.`
  }

  let mealDays = 0
  let exerciseDays = 0
  let medicationDays = 0
  let medicationStreak = 0
  let maxMedicationStreak = 0

  for (const d of dates) {
    if (days[d].meal) mealDays += 1
    if (days[d].exercise) exerciseDays += 1
    if (days[d].medication) {
      medicationDays += 1
      medicationStreak += 1
      maxMedicationStreak = Math.max(maxMedicationStreak, medicationStreak)
    } else {
      medicationStreak = 0
    }
  }

  const parts: string[] = []
  
  // 복약 연속일 강조
  if (maxMedicationStreak >= 3) {
    parts.push(`${memberNickname}${isOwn ? '께서' : '님께서'} ${maxMedicationStreak}일 연속 혈압약을 잊지 않으셨어요!`)
  } else if (medicationDays > 0) {
    parts.push(`복약을 꾸준히 챙기고 계세요.`)
  }

  if (exerciseDays > 0) {
    parts.push(`운동도 ${exerciseDays}일 기록하셨어요.`)
  }

  if (mealDays > 0) {
    parts.push(`식단 기록도 ${mealDays}일 하셨어요.`)
  }

  if (parts.length === 0) {
    return '이번 기간에는 활동 기록이 없었어요.'
  }

  return parts.join(' ') + ' 작은 습관이 모여 더 건강한 일상을 만들어 가고 있어요.'
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const memberChartNumber = searchParams.get('member_chart_number')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!memberChartNumber || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'member_chart_number, start_date, end_date가 필요합니다.' },
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

    // 현재 사용자 정보
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('chart_number')
      .eq('id', user.id)
      .single()

    if (!currentProfile?.chart_number) {
      return NextResponse.json(
        { success: false, error: '차트 번호가 없습니다.' },
        { status: 403 }
      )
    }

    // 조회 대상 멤버 정보
    const { data: memberProfile } = await supabase
      .from('profiles')
      .select('id, chart_number, nickname')
      .eq('chart_number', memberChartNumber)
      .single()

    if (!memberProfile) {
      return NextResponse.json(
        { success: false, error: '멤버를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 그룹 관계 확인 (같은 그룹에 속해있는지)
    const { data: currentUserGroup } = await supabase
      .from('user_groups')
      .select('group_id')
      .contains('member_chart_numbers', [currentProfile.chart_number])
      .limit(1)
      .single()

    const { data: memberGroup } = await supabase
      .from('user_groups')
      .select('group_id')
      .contains('member_chart_numbers', [memberChartNumber])
      .limit(1)
      .single()

    // 같은 그룹에 속해있지 않으면 접근 불가
    if (!currentUserGroup || !memberGroup || currentUserGroup.group_id !== memberGroup.group_id) {
      return NextResponse.json(
        { success: false, error: '같은 그룹에 속한 멤버만 조회할 수 있습니다.' },
        { status: 403 }
      )
    }

    // 해당 멤버의 건강 로그 조회 (날짜와 카테고리만, 수치 없음)
    const { data: logs, error: logsError } = await supabase
      .from('health_logs')
      .select('logged_at, category')
      .eq('user_id', memberProfile.id)
      .gte('logged_at', `${startDate}T00:00:00`)
      .lte('logged_at', `${endDate}T23:59:59`)
      .in('category', ['meal', 'exercise', 'medication'])

    if (logsError) {
      console.error('[Member Calendar] 조회 에러:', logsError)
      return NextResponse.json(
        { success: false, error: '건강 로그 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 날짜별로 집계
    const rows = (logs || []).map(log => ({
      activity_date: log.logged_at.slice(0, 10),
      category: log.category
    }))

    const days = aggregateDays(rows)
    const isOwn = currentProfile.chart_number === memberChartNumber
    const nickname = memberProfile.nickname || (isOwn ? '나' : '회원')
    const aiComment = buildPersonalComment(nickname, days, isOwn)

    return NextResponse.json({
      success: true,
      days,
      aiComment,
      nickname,
      isOwn
    })
  } catch (e) {
    console.error('[Member Calendar] 서버 에러:', e)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
