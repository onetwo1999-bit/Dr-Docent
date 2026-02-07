/**
 * 기록 완료 시 AI 코치의 즉시 반응 메시지 (카테고리·선택적 payload 기반)
 */

export type FeedbackCategory = 'meal' | 'exercise' | 'medication' | 'sleep'

export interface FeedbackPayload {
  sleep_duration_hours?: number | null
  medication_name?: string | null
  exercise_type?: string | null
  duration_minutes?: number | null
}

const messages: Record<FeedbackCategory, string | ((payload?: FeedbackPayload) => string)> = {
  meal: '식사 기록 반영했어요. 영양 밸런스 분석에 반영됩니다.',
  exercise: '운동 기록 감사해요! 강도와 회복 패턴을 반영할게요.',
  medication: '방금 기록하신 약은 식후 30분이 중요합니다! 꾸준히 챙기시면 좋아요.',
  sleep: (payload) => {
    const h = payload?.sleep_duration_hours
    if (h != null && h < 6) return '오늘 수면 시간이 부족하네요. 오후에 짧은 낮잠을 추천드려요.'
    if (h != null && h >= 8) return '수면 기록 감사해요. 충분한 휴식이 회복에 도움이 됩니다.'
    return '수면 기록 반영했어요. 회복 패턴 분석에 활용할게요.'
  },
}

export function getInstantFeedbackMessage(
  category: FeedbackCategory,
  payload?: FeedbackPayload
): string {
  const m = messages[category]
  return typeof m === 'function' ? m(payload) : m
}
