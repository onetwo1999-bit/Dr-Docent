/**
 * 사용자 ID 기준 최근 7일 건강 데이터 집계
 * health_logs, schedules, health_scores, profiles를 하나의 JSON 요약으로 반환.
 * AI 시스템 프롬프트용 "Current Health Context" 생성에 사용.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DAYS = 7

export interface DaySleep {
  date: string
  hours: number | null
  logged: boolean
}

export interface DayExercise {
  date: string
  type: string | null
  duration_minutes: number | null
  heart_rate: number | null
  intensity_summary: string | null
}

export interface DayMeal {
  date: string
  descriptions: string[]
  photo_count: number
}

export interface DayMedication {
  date: string
  count: number
  items: string[]
}

export interface HealthAggregateSummary {
  period: { start: string; end: string }
  sleep: {
    daily: DaySleep[]
    avg_hours_last_7_days: number | null
    days_with_record: number
  }
  exercise: {
    daily: DayExercise[]
    types: string[]
    total_sessions: number
    high_intensity_days: number
  }
  diet: {
    daily: DayMeal[]
    total_meals: number
    days_with_photo: number
    summary_text: string
  }
  medication: {
    daily: DayMedication[]
    total_logs: number
    adherence_days: number
    expected_per_day_from_schedules: number | null
  }
  ranking: {
    today_score: number | null
    today_rank: number | null
    score_7_days_ago: number | null
    score_trend: 'up' | 'down' | 'stable' | null
  }
  profile_summary: {
    has_profile: boolean
    chart_number_masked: string | null
  }
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function aggregateHealthContext(
  supabase: SupabaseClient,
  userId: string
): Promise<HealthAggregateSummary> {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (DAYS - 1))
  start.setHours(0, 0, 0, 0)
  const startStr = toDateStr(start)
  const endStr = toDateStr(end)

  const emptySummary = (): HealthAggregateSummary => ({
    period: { start: startStr, end: endStr },
    sleep: { daily: [], avg_hours_last_7_days: null, days_with_record: 0 },
    exercise: { daily: [], types: [], total_sessions: 0, high_intensity_days: 0 },
    diet: { daily: [], total_meals: 0, days_with_photo: 0, summary_text: '' },
    medication: { daily: [], total_logs: 0, adherence_days: 0, expected_per_day_from_schedules: null },
    ranking: { today_score: null, today_rank: null, score_7_days_ago: null, score_trend: null },
    profile_summary: { has_profile: false, chart_number_masked: null },
  })

  const [profileRes, logsRes, schedulesRes, scoresRes, todayScoresRes] = await Promise.all([
    supabase.from('profiles').select('chart_number').eq('id', userId).single(),
    supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', `${startStr}T00:00:00`)
      .lte('logged_at', `${endStr}T23:59:59`)
      .order('logged_at', { ascending: true }),
    supabase.from('schedules').select('id, category, frequency').eq('user_id', userId).eq('is_active', true),
    supabase
      .from('health_scores')
      .select('chart_number, score_date, score')
      .gte('score_date', startStr)
      .lte('score_date', endStr)
      .order('score_date', { ascending: true }),
    supabase
      .from('health_scores')
      .select('chart_number, score')
      .eq('score_date', endStr)
      .order('score', { ascending: false }),
  ])

  const myChartNumber = (profileRes.data as { chart_number?: string } | null)?.chart_number ?? null
  const allScores = (scoresRes.data ?? []) as { chart_number: string; score_date: string; score: number }[]
  const myScores = myChartNumber
    ? allScores.filter((r) => r.chart_number === myChartNumber)
    : []
  const scoresByDate = new Map(myScores.map((r) => [r.score_date, Number(r.score)]))
  const chartMasked = myChartNumber != null ? String(myChartNumber).slice(0, 3) + '***' : null

  const logs = (logsRes.data ?? []) as RawHealthLog[]
  const schedules = schedulesRes.data ?? []

  const dailySleep: DaySleep[] = []
  const dailyExercise: DayExercise[] = []
  const dailyMeals: DayMeal[] = []
  const dailyMeds: DayMedication[] = []
  const exerciseTypes = new Set<string>()
  const highIntensityDates = new Set<string>()
  let totalSleepHours = 0
  let sleepDaysWithRecord = 0

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = toDateStr(d)

    const dayLogs = logs.filter((l) => (l.logged_at || '').startsWith(dateStr))

    const sleepLogs = dayLogs.filter((l) => l.category === 'sleep')
    const sleepHours =
      sleepLogs.length > 0
        ? sleepLogs.reduce((s, l) => s + (Number(l.sleep_duration_hours) || 0), 0) / sleepLogs.length
        : null
    if (sleepHours != null && !Number.isNaN(sleepHours)) {
      totalSleepHours += sleepHours
      sleepDaysWithRecord += 1
    }
    dailySleep.push({
      date: dateStr,
      hours: sleepHours != null && !Number.isNaN(sleepHours) ? Math.round(sleepHours * 10) / 10 : null,
      logged: sleepLogs.length > 0,
    })

    const exLogs = dayLogs.filter((l) => l.category === 'exercise')
    for (const ex of exLogs) {
      const type = ex.exercise_type || ex.sub_type || '기록됨'
      exerciseTypes.add(type)
      const dur = ex.duration_minutes != null ? Number(ex.duration_minutes) : null
      const hr = ex.heart_rate != null ? Number(ex.heart_rate) : null
      const intensity = (ex.intensity_metrics as Record<string, unknown>)?.level ?? (ex.intensity_metrics as Record<string, unknown>)?.intensity
      const intensityStr =
        typeof intensity === 'string' ? intensity : hr != null ? `심박 ${hr}` : dur != null ? `${dur}분` : null
      if (
        intensityStr &&
        (String(intensityStr).includes('고강도') ||
          String(intensityStr).includes('high') ||
          (hr != null && hr >= 160))
      ) {
        highIntensityDates.add(dateStr)
      }
      dailyExercise.push({
        date: dateStr,
        type,
        duration_minutes: dur,
        heart_rate: hr,
        intensity_summary: intensityStr as string | null,
      })
    }
    if (exLogs.length === 0) {
      dailyExercise.push({
        date: dateStr,
        type: null,
        duration_minutes: null,
        heart_rate: null,
        intensity_summary: null,
      })
    }

    const mealLogs = dayLogs.filter((l) => l.category === 'meal')
    const descriptions = mealLogs.map(
      (l) => String(l.meal_description ?? l.notes ?? l.note ?? '식사 기록').slice(0, 200)
    )
    const photoCount = mealLogs.filter((l) => l.image_url).length
    dailyMeals.push({ date: dateStr, descriptions, photo_count: photoCount })

    const medLogs = dayLogs.filter((l) => l.category === 'medication')
    dailyMeds.push({
      date: dateStr,
      count: medLogs.length,
      items: medLogs.map((l) => String(l.medication_name ?? l.notes ?? l.note ?? '복약').slice(0, 80)),
    })
  }

  const medSchedules = schedules.filter((s: { category?: string }) => s.category === 'medication')
  const expectedMedsPerDay =
    medSchedules.length > 0
      ? medSchedules.length
      : null

  const todayScores = (todayScoresRes as { data?: { chart_number: string; score: number }[] })?.data ?? []
  const myTodayScore = myChartNumber
    ? todayScores.find((r) => r.chart_number === myChartNumber)?.score
    : null
  const todayRank =
    myChartNumber && todayScores.length > 0
      ? todayScores.findIndex((r) => r.chart_number === myChartNumber) + 1
      : null

  const scoreToday = scoresByDate.get(endStr) ?? myTodayScore ?? null
  const scoreStart = scoresByDate.get(startStr) ?? null
  let scoreTrend: 'up' | 'down' | 'stable' | null = null
  if (scoreToday != null && scoreStart != null) {
    if (scoreToday > scoreStart) scoreTrend = 'up'
    else if (scoreToday < scoreStart) scoreTrend = 'down'
    else scoreTrend = 'stable'
  }

  const totalMeals = dailyMeals.reduce((s, d) => s + d.descriptions.length, 0)
  const daysWithPhoto = dailyMeals.filter((d) => d.photo_count > 0).length
  const dietSummaryLines = dailyMeals
    .filter((d) => d.descriptions.length > 0)
    .map((d) => `${d.date}: ${d.descriptions.join(', ')}`)
  const summary_text = dietSummaryLines.length > 0 ? dietSummaryLines.join(' | ') : '최근 7일 식단 기록 없음.'

  const adherenceDays = dailyMeds.filter((d) => d.count > 0).length

  return {
    period: { start: startStr, end: endStr },
    sleep: {
      daily: dailySleep,
      avg_hours_last_7_days:
        sleepDaysWithRecord > 0 ? Math.round((totalSleepHours / sleepDaysWithRecord) * 10) / 10 : null,
      days_with_record: sleepDaysWithRecord,
    },
    exercise: {
      daily: dailyExercise.filter((e) => e.type != null),
      types: [...exerciseTypes],
      total_sessions: dailyExercise.filter((e) => e.type != null).length,
      high_intensity_days: highIntensityDates.size,
    },
    diet: {
      daily: dailyMeals,
      total_meals: totalMeals,
      days_with_photo: daysWithPhoto,
      summary_text: String(summary_text).slice(0, 1500),
    },
    medication: {
      daily: dailyMeds,
      total_logs: dailyMeds.reduce((s, d) => s + d.count, 0),
      adherence_days: adherenceDays,
      expected_per_day_from_schedules: expectedMedsPerDay,
    },
    ranking: {
      today_score: scoreToday ?? myTodayScore ?? null,
      today_rank: todayRank,
      score_7_days_ago: scoreStart ?? null,
      score_trend: scoreTrend,
    },
    profile_summary: {
      has_profile: !!profileRes.data,
      chart_number_masked: chartMasked,
    },
  }
}

/** AI 프롬프트에 넣을 텍스트로 직렬화 (한국어, 요약) */
export function formatAggregateForPrompt(summary: HealthAggregateSummary): string {
  const lines: string[] = []
  lines.push(`[집계 기간: ${summary.period.start} ~ ${summary.period.end}]`)

  if (summary.sleep.avg_hours_last_7_days != null) {
    lines.push(
      `- 수면: 7일 중 ${summary.sleep.days_with_record}일 기록, 일평균 약 ${summary.sleep.avg_hours_last_7_days}시간`
    )
    const lowSleepDays = summary.sleep.daily.filter((d) => d.hours != null && d.hours < 6)
    if (lowSleepDays.length > 0) {
      lines.push(`  - 6시간 미만 수면일: ${lowSleepDays.map((d) => d.date).join(', ')}`)
    }
  } else {
    lines.push('- 수면: 최근 7일 수면 기록 없음')
  }

  if (summary.exercise.total_sessions > 0) {
    lines.push(
      `- 운동: 총 ${summary.exercise.total_sessions}회 (종류: ${summary.exercise.types.join(', ') || '기록됨'})`
    )
    if (summary.exercise.high_intensity_days > 0) {
      lines.push(`  - 고강도 운동 기록일: ${summary.exercise.high_intensity_days}일`)
    }
    (Array.isArray(summary.exercise.daily) ? summary.exercise.daily.slice(-5) : []).forEach((e) => {
      if (e.type) {
        const part = [e.date, e.type, e.duration_minutes != null ? `${e.duration_minutes}분` : null, e.intensity_summary].filter(Boolean).join(' ')
        lines.push(`  - ${part}`)
      }
    })
  } else {
    lines.push('- 운동: 최근 7일 운동 기록 없음')
  }

  lines.push(`- 식단: 총 ${summary.diet.total_meals}회 식사 기록, 사진 ${summary.diet.days_with_photo}일분`)
  if (summary.diet.summary_text && summary.diet.summary_text !== '최근 7일 식단 기록 없음.') {
    const st = String(summary.diet.summary_text)
    lines.push(`  요약: ${st.slice(0, 500)}${st.length > 500 ? '…' : ''}`)
  }

  lines.push(
    `- 복약: 7일 중 ${summary.medication.adherence_days}일 기록, 총 ${summary.medication.total_logs}회`
  )
  if (summary.medication.expected_per_day_from_schedules != null) {
    lines.push(`  - 스케줄 기준 예상 일일 복약 수: ${summary.medication.expected_per_day_from_schedules}`)
  }

  if (summary.ranking.today_score != null) {
    const rankStr = summary.ranking.today_rank != null ? `, 현재 랭킹 약 ${summary.ranking.today_rank}위` : ''
    const trendStr =
      summary.ranking.score_trend === 'up'
        ? ' (7일 전 대비 상승)'
        : summary.ranking.score_trend === 'down'
          ? ' (7일 전 대비 하락)'
          : ''
    lines.push(`- 랭킹/점수: 오늘 ${summary.ranking.today_score}점${rankStr}${trendStr}`)
  }

  return lines.join('\n')
}

interface RawHealthLog {
  category: string
  logged_at?: string
  notes?: string | null
  note?: string | null
  meal_description?: string | null
  image_url?: string | null
  exercise_type?: string | null
  sub_type?: string | null
  duration_minutes?: number | null
  heart_rate?: number | null
  intensity_metrics?: unknown
  sleep_duration_hours?: number | null
  medication_name?: string | null
}
