'use client'

import { useState, useEffect, useCallback } from 'react'
import { OTTER_STATUS_LABELS, OTTER_ACTION_LABELS, getOtterMoodSummary } from '@/lib/otter'
import type { OtterState, OtterActionType } from '@/lib/otter'

const ACTION_ORDER: OtterActionType[] = ['feed', 'walk', 'sleep', 'supplement']

const ACTION_EMOJI: Record<OtterActionType, string> = {
  feed:       '🍚',
  walk:       '🏃',
  sleep:      '😴',
  supplement: '💊',
}

export default function OtterCard() {
  const [state, setState] = useState<OtterState | null>(null)
  const [latestReaction, setLatestReaction] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/otter/state')
      if (!res.ok) return
      const data: OtterState = await res.json()
      setState(data)

      // 완료된 액션 중 반응 없는 것 → GPT 반응 생성 요청
      const pendingActions = ACTION_ORDER.filter(
        (action) => data.status[action] && !data.reactions[action]
      )
      if (pendingActions.length > 0) {
        // 가장 최근 액션 1개만 처리 (API 비용 절약)
        const action = pendingActions[pendingActions.length - 1]
        const reactRes = await fetch('/api/otter/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_type: action }),
        })
        if (reactRes.ok) {
          const { reaction_text } = await reactRes.json()
          setLatestReaction(reaction_text)
          // 로컬 state에 반응 반영
          setState((prev) =>
            prev ? { ...prev, reactions: { ...prev.reactions, [action]: reaction_text } } : prev
          )
        }
      } else {
        // 기존 캐시 중 가장 최신 반응 표시
        const lastAction = ACTION_ORDER.filter((a) => data.reactions[a]).pop()
        if (lastAction) setLatestReaction(data.reactions[lastAction] ?? null)
      }
    } catch {
      // 네트워크 오류 무시
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()

    // HealthLogButtons가 기록 저장 후 발행하는 이벤트 수신
    const handler = () => fetchState()
    window.addEventListener('health-log-updated', handler)
    return () => window.removeEventListener('health-log-updated', handler)
  }, [fetchState])

  if (loading) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm animate-pulse">
        <div className="h-5 w-24 bg-gray-100 rounded mb-3" />
        <div className="h-16 bg-gray-50 rounded-xl" />
      </div>
    )
  }

  if (!state) return null

  const moodSummary = getOtterMoodSummary(state.status)
  const completedCount = state.completedCount

  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦦</span>
          <div>
            <h3 className="font-bold text-gray-900 text-base leading-tight">{state.name}</h3>
            <p className="text-xs text-gray-400">오늘 {completedCount}/4 케어 완료</p>
          </div>
        </div>
        {/* 완료 진행률 */}
        <div className="flex items-center gap-1">
          {ACTION_ORDER.map((action) => (
            <div
              key={action}
              className={`w-2 h-2 rounded-full transition-all ${
                state.status[action] ? 'bg-[#2DD4BF]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* GPT 반응 말풍선 */}
      {latestReaction && (
        <div className="mb-3 px-3 py-2 bg-[#2DD4BF]/8 border border-[#2DD4BF]/20 rounded-xl text-sm text-gray-700 relative">
          <span className="absolute -top-1.5 left-4 text-[#2DD4BF]/40 text-lg leading-none">"</span>
          {latestReaction}
        </div>
      )}

      {/* 4개 상태 뱃지 */}
      <div className="grid grid-cols-4 gap-1.5">
        {ACTION_ORDER.map((action) => {
          const done = state.status[action]
          return (
            <div
              key={action}
              className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                done
                  ? 'bg-[#2DD4BF]/8 border-[#2DD4BF]/30'
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              <span className={`text-lg mb-0.5 ${done ? '' : 'grayscale opacity-40'}`}>
                {ACTION_EMOJI[action]}
              </span>
              <span className={`text-[10px] font-semibold leading-tight text-center ${
                done ? 'text-[#2DD4BF]' : 'text-gray-400'
              }`}>
                {done
                  ? OTTER_STATUS_LABELS[action].done
                  : OTTER_STATUS_LABELS[action].pending}
              </span>
            </div>
          )
        })}
      </div>

      {/* 전체 기분 요약 */}
      <p className="mt-3 text-xs text-gray-400 text-center leading-relaxed">
        {moodSummary}
      </p>
    </div>
  )
}
