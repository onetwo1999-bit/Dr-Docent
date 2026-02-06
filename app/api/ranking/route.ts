/**
 * 유료 구독자 실시간 건강 점수 랭킹 API
 * 점수 공식: S = Σ(Data × Weight) + (Streak × Bonus)
 * 가중치: 복약(High), 운동(Medium), 식단(Medium)
 * 보안: 위치 정보(GPS) 수집 없음, 입력된 5종 데이터(식단·운동·복약·연속일·일일 달성)로만 산출
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─── 가중치 (복약 High, 운동/식단 Medium) ───
const WEIGHT_MEDICATION = 0.4
const WEIGHT_EXERCISE = 0.3
const WEIGHT_MEAL = 0.3
const STREAK_BONUS_PER_DAY = 2
/** 일일 3종(식단+운동+복약) 모두 기록 시 추가 가산 */
const FULL_DAY_BONUS = 5

const BASE_SCALE = 100

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
          // Route Handler에서 쿠키 설정 제한 가능
        }
      },
    },
  })
}

/** 차트 번호 마스킹 (개인정보 보호): D76850 → D76*** */
function maskChartNumber(chartNumber: string | unknown): string {
  const s = typeof chartNumber === 'string' ? chartNumber : String(chartNumber ?? '')
  if (!s || s.length < 4) return '***'
  return s.slice(0, 3) + '***'
}

/** 해당 날짜의 건강 로그로 일일 점수 산출 (GPS 미사용, 5종 데이터만) */
function computeDailyScore(params: {
  hasMedication: boolean
  hasExercise: boolean
  hasMeal: boolean
  streakDays: number
}): number {
  const { hasMedication, hasExercise, hasMeal, streakDays } = params
  const dataPart =
    (hasMedication ? WEIGHT_MEDICATION : 0) +
    (hasExercise ? WEIGHT_EXERCISE : 0) +
    (hasMeal ? WEIGHT_MEAL : 0)
  const streakBonus = streakDays * STREAK_BONUS_PER_DAY
  const fullDayBonus = hasMedication && hasExercise && hasMeal ? FULL_DAY_BONUS : 0
  return dataPart * BASE_SCALE + streakBonus + fullDayBonus
}

/** user_id별 해당 날짜 로그 집계 (식단/운동/복약) */
function aggregateLogsByUser(
  logs: { user_id: string; category: string; logged_at: string | Date }[],
  dateStr: string
): Map<
  string,
  { meal: number; exercise: number; medication: number }
> {
  const dayStart = `${dateStr}T00:00:00`
  const dayEnd = `${dateStr}T23:59:59`
  const map = new Map<
    string,
    { meal: number; exercise: number; medication: number }
  >()
  for (const log of logs) {
    const logStr = typeof log.logged_at === 'string' ? log.logged_at : new Date(log.logged_at).toISOString()
    if (logStr < dayStart || logStr > dayEnd) continue
    let cur = map.get(log.user_id)
    if (!cur) {
      cur = { meal: 0, exercise: 0, medication: 0 }
      map.set(log.user_id, cur)
    }
    if (log.category === 'meal') cur.meal += 1
    else if (log.category === 'exercise') cur.exercise += 1
    else if (log.category === 'medication') cur.medication += 1
  }
  return map
}

/** logged_at을 YYYY-MM-DD 문자열로 반환 (Supabase가 Date 객체로 반환해도 안전) */
function toDateString(loggedAt: string | Date | unknown): string {
  if (typeof loggedAt === 'string') return loggedAt.slice(0, 10)
  if (loggedAt instanceof Date) return loggedAt.toISOString().slice(0, 10)
  if (loggedAt != null) return new Date(loggedAt as string | number).toISOString().slice(0, 10)
  return ''
}

/** 연속 기록 일수 계산 (해당 날짜 포함, 그날부터 과거로 연속된 일수) */
function computeStreakDays(
  logs: { user_id: string; logged_at: string | Date }[],
  userId: string,
  upToDateStr: string
): number {
  const userDays = [...new Set(
    logs
      .filter((l) => l.user_id === userId)
      .map((l) => toDateString(l.logged_at))
      .filter(Boolean)
  )].sort()
  const end = new Date(upToDateStr)
  end.setHours(0, 0, 0, 0)
  let streak = 0
  let cursor = new Date(end)
  while (true) {
    const dayStr = cursor.toISOString().slice(0, 10)
    if (!userDays.includes(dayStr)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const scoreDate = dateParam
      ? new Date(dateParam)
      : new Date()
    const dateStr = scoreDate.toISOString().slice(0, 10)

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('chart_number')
      .eq('id', user.id)
      .single()
    const myChartNumber = (myProfile as { chart_number?: string } | null)?.chart_number ?? null

    // 1) health_scores에 해당 날짜 데이터가 있으면 우선 사용 (실시간에 가깝게)
    const { data: existingScores } = await supabase
      .from('health_scores')
      .select('chart_number, score')
      .eq('score_date', dateStr)
      .order('score', { ascending: false })
      .limit(10)

    if (existingScores && existingScores.length > 0) {
      const chartNumbers = existingScores.map((r) => r.chart_number)
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .in('chart_number', chartNumbers)
      if (profileErr) {
        console.warn('[Ranking] profiles 조회 실패( chart_number/nickname 미설정 시 발생 ):', profileErr.message)
      }
      const profileMap = new Map(
        (profiles || []).map((p: { chart_number?: string; nickname?: string }) => [
          p.chart_number ?? '',
          p.nickname ?? '회원',
        ])
      )

      const ranking = existingScores.map((row, index) => ({
        rank: index + 1,
        chart_number_masked: maskChartNumber(row.chart_number),
        nickname: profileMap.get(row.chart_number) ?? '회원',
        score: Number(row.score),
      }))

      let me: { rank: number; score: number; chart_number_masked: string } | null = null
      if (myChartNumber) {
        const { data: myRow } = await supabase
          .from('health_scores')
          .select('score')
          .eq('chart_number', myChartNumber)
          .eq('score_date', dateStr)
          .single()
        if (myRow) {
          const myScore = Number((myRow as { score: number }).score)
          const { count } = await supabase
            .from('health_scores')
            .select('*', { count: 'exact', head: true })
            .eq('score_date', dateStr)
            .gt('score', myScore)
          const myRank = (count ?? 0) + 1
          me = { rank: myRank, score: myScore, chart_number_masked: maskChartNumber(myChartNumber) }
        }
      }

      return NextResponse.json({
        success: true,
        date: dateStr,
        source: 'health_scores',
        ranking,
        me,
      })
    }

    // 2) health_scores 없으면 health_logs로 당일 실시간 집계 (user_id → chart_number는 profiles 필요)
    const startOfDay = `${dateStr}T00:00:00`
    const endOfDay = `${dateStr}T23:59:59`
    const { data: dayLogs, error: logsError } = await supabase
      .from('health_logs')
      .select('user_id, category, logged_at')
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay)

    if (logsError) {
      console.error('[Ranking] health_logs 조회 에러:', logsError)
      return NextResponse.json(
        { success: false, error: '랭킹 데이터 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const aggregated = aggregateLogsByUser(dayLogs || [], dateStr)
    const userIds = [...aggregated.keys()]
    if (userIds.length === 0) {
      let me: { rank: number; score: number; chart_number_masked: string } | null = null
      if (myChartNumber) {
        const { data: myRow } = await supabase
          .from('health_scores')
          .select('score')
          .eq('chart_number', myChartNumber)
          .eq('score_date', dateStr)
          .single()
        if (myRow) {
          const myScore = Number((myRow as { score: number }).score)
          const { count } = await supabase
            .from('health_scores')
            .select('*', { count: 'exact', head: true })
            .eq('score_date', dateStr)
            .gt('score', myScore)
          me = { rank: (count ?? 0) + 1, score: myScore, chart_number_masked: maskChartNumber(myChartNumber) }
        }
      }
      return NextResponse.json({
        success: true,
        date: dateStr,
        source: 'realtime',
        ranking: [],
        me,
        message: '해당 날짜에 기록이 없습니다.',
      })
    }

    const { data: profilesById } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds)

    type ProfileRow = { id: string; chart_number?: string; nickname?: string }
    const chartByUserId = new Map(
      (profilesById || []).map((p: ProfileRow) => [p.id, p.chart_number])
    )
    const nicknameByChart = new Map(
      (profilesById || []).map((p: ProfileRow) => [p.chart_number ?? '', p.nickname ?? '회원'])
    )

    const sevenDaysAgo = new Date(scoreDate)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const { data: streakLogs } = await supabase
      .from('health_logs')
      .select('user_id, logged_at')
      .in('user_id', userIds)
      .gte('logged_at', sevenDaysAgo.toISOString())
      .lte('logged_at', endOfDay)

    const scores: { chart_number: string; score: number; nickname: string }[] = []
    for (const uid of userIds) {
      const chartNumber = chartByUserId.get(uid)
      if (!chartNumber) continue
      const agg = aggregated.get(uid)!
      const streak = computeStreakDays(streakLogs || [], uid, dateStr)
      const score = computeDailyScore({
        hasMedication: (agg.medication ?? 0) >= 1,
        hasExercise: (agg.exercise ?? 0) >= 1,
        hasMeal: (agg.meal ?? 0) >= 1,
        streakDays: streak,
      })
      scores.push({
        chart_number: chartNumber,
        score,
        nickname: nicknameByChart.get(chartNumber) ?? '회원',
      })
    }

    scores.sort((a, b) => b.score - a.score)
    const top10 = scores.slice(0, 10).map((s, i) => ({
      rank: i + 1,
      chart_number_masked: maskChartNumber(s.chart_number),
      nickname: s.nickname,
      score: Math.round(s.score * 100) / 100,
    }))

    let me: { rank: number; score: number; chart_number_masked: string } | null = null
    if (myChartNumber) {
      const myIdx = scores.findIndex((s) => s.chart_number === myChartNumber)
      if (myIdx >= 0) {
        const s = scores[myIdx]
        me = {
          rank: myIdx + 1,
          score: Math.round(s.score * 100) / 100,
          chart_number_masked: maskChartNumber(s.chart_number),
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      source: 'realtime',
      ranking: top10,
      me,
    })
  } catch (e) {
    console.error('[Ranking] 서버 에러:', e)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
