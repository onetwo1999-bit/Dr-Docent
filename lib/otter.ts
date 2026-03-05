import { SupabaseClient } from '@supabase/supabase-js'

// =====================================================
// 타입 정의
// =====================================================

export type OtterActionType = 'feed' | 'walk' | 'sleep' | 'supplement'

export interface OtterStatus {
  feed: boolean       // meal 기록 있으면 true → 배부름
  walk: boolean       // exercise 기록 있으면 true → 활발함
  sleep: boolean      // sleep 기록 있으면 true → 잘 잠
  supplement: boolean // medication 기록 있으면 true → 건강함
}

export interface OtterState {
  name: string
  status: OtterStatus
  completedCount: number // 오늘 완료한 액션 수 (0~4)
  reactions: Partial<Record<OtterActionType, string>> // 오늘 캐시된 GPT 반응
}

// health_logs category → otter action 매핑
export const CATEGORY_TO_ACTION: Record<string, OtterActionType> = {
  meal:       'feed',
  exercise:   'walk',
  sleep:      'sleep',
  medication: 'supplement',
}

export const OTTER_ACTION_LABELS: Record<OtterActionType, string> = {
  feed:       '밥 주기',
  walk:       '산책',
  sleep:      '재우기',
  supplement: '영양제 챙기기',
}

export const OTTER_STATUS_LABELS: Record<OtterActionType, { done: string; pending: string }> = {
  feed:       { done: '배불러요',      pending: '배고파요' },
  walk:       { done: '활발해요',      pending: '심심해요' },
  sleep:      { done: '잘 잤어요',     pending: '졸려요' },
  supplement: { done: '건강해요',      pending: '영양제가 필요해요' },
}

// =====================================================
// 오늘 날짜를 KST 기준 'YYYY-MM-DD'로 반환
// =====================================================
function getTodayKST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

// =====================================================
// 수달 상태 계산
// 오늘 health_logs + sleep_logs 기록으로 4가지 상태 결정
// =====================================================
export async function getOtterState(
  supabase: SupabaseClient,
  userId: string
): Promise<OtterState> {
  const today = getTodayKST()
  const todayStart = `${today}T00:00:00+09:00`
  const todayEnd   = `${today}T23:59:59+09:00`

  const [petResult, logsResult, sleepLogResult, reactionsResult] = await Promise.all([
    // 수달 이름
    supabase
      .from('otter_pets')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle(),

    // 오늘 health_logs (category만 필요)
    supabase
      .from('health_logs')
      .select('category')
      .eq('user_id', userId)
      .gte('logged_at', todayStart)
      .lte('logged_at', todayEnd),

    // 오늘 sleep_logs (health_logs.sleep과 별개로 기록된 경우 보완)
    supabase
      .from('sleep_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('sleep_date', today)
      .maybeSingle(),

    // 오늘 캐시된 수달 반응
    supabase
      .from('otter_reactions')
      .select('action_type, reaction_text')
      .eq('user_id', userId)
      .eq('reacted_date', today),
  ])

  const name = petResult.data?.name ?? '도달이'

  const categories = new Set(
    (logsResult.data ?? []).map((r: { category: string }) => r.category)
  )

  const status: OtterStatus = {
    feed:       categories.has('meal'),
    walk:       categories.has('exercise'),
    sleep:      categories.has('sleep') || !!sleepLogResult.data,
    supplement: categories.has('medication'),
  }

  const completedCount = Object.values(status).filter(Boolean).length

  const reactions: Partial<Record<OtterActionType, string>> = {}
  for (const row of reactionsResult.data ?? []) {
    reactions[row.action_type as OtterActionType] = row.reaction_text
  }

  return { name, status, completedCount, reactions }
}

// =====================================================
// 수달 전체 기분 한 줄 요약
// =====================================================
export function getOtterMoodSummary(status: OtterStatus): string {
  const done = Object.values(status).filter(Boolean).length
  if (done === 4) return `${OTTER_ACTION_LABELS.feed} · 산책 · 수면 · 영양제 모두 완료! 도달이가 가장 행복해요.`
  if (done === 0) return '도달이가 기다리고 있어요. 오늘 첫 기록을 남겨볼까요?'

  const pending = (Object.keys(status) as OtterActionType[])
    .filter((k) => !status[k])
    .map((k) => OTTER_STATUS_LABELS[k].pending)

  return `도달이가 ${pending.join(', ')} 상태예요.`
}
