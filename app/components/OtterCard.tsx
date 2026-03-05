'use client'

import { useState, useEffect, useCallback } from 'react'
import { OTTER_STATUS_LABELS, getOtterMoodSummary } from '@/lib/otter'
import type { OtterState, OtterActionType } from '@/lib/otter'
import HealthLogButtons from './HealthLogButtons'

const ACTION_ORDER: OtterActionType[] = ['feed', 'walk', 'sleep', 'supplement']

const ACTION_EMOJI: Record<OtterActionType, string> = {
  feed:       '🍚',
  walk:       '🏃',
  sleep:      '😴',
  supplement: '💊',
}

type OtterMood = 'happy' | 'normal' | 'waiting'

function OtterSVG({ mood }: { mood: OtterMood }) {
  return (
    <svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
      {/* 귀 */}
      <circle cx="36" cy="30" r="11" fill="#A0714F" />
      <circle cx="84" cy="30" r="11" fill="#A0714F" />
      <circle cx="36" cy="30" r="6" fill="#C9956A" />
      <circle cx="84" cy="30" r="6" fill="#C9956A" />

      {/* 몸통 */}
      <ellipse cx="60" cy="101" rx="33" ry="26" fill="#A0714F" />
      {/* 배 */}
      <ellipse cx="60" cy="106" rx="21" ry="17" fill="#D4A574" />

      {/* 머리 */}
      <circle cx="60" cy="56" r="32" fill="#A0714F" />
      {/* 얼굴 패치 */}
      <ellipse cx="60" cy="62" rx="20" ry="17" fill="#D4A574" />

      {/* 꼬리 */}
      <ellipse cx="60" cy="125" rx="15" ry="6" fill="#8B6347" />

      {/* 앞발 */}
      <ellipse cx="34" cy="114" rx="10" ry="7" fill="#8B6347" />
      <ellipse cx="86" cy="114" rx="10" ry="7" fill="#8B6347" />

      {/* 볼 */}
      <circle cx="43" cy="67" r="7" fill="#E8956D" opacity="0.45" />
      <circle cx="77" cy="67" r="7" fill="#E8956D" opacity="0.45" />

      {/* 코 */}
      <ellipse cx="60" cy="64" rx="4.5" ry="3.5" fill="#5C3D2E" />

      {/* 기분별 표정 */}
      {mood === 'happy' && (
        <>
          {/* 행복 — 찡긋 눈 */}
          <path d="M 47 52 Q 52 47 57 52" stroke="#5C3D2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 63 52 Q 68 47 73 52" stroke="#5C3D2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* 큰 웃음 */}
          <path d="M 48 73 Q 60 83 72 73" stroke="#5C3D2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* 반짝이 */}
          <text x="16" y="42" fontSize="13" opacity="0.85">✨</text>
          <text x="86" y="42" fontSize="13" opacity="0.85">✨</text>
        </>
      )}

      {mood === 'normal' && (
        <>
          {/* 보통 — 동그란 눈 */}
          <circle cx="52" cy="53" r="5.5" fill="#5C3D2E" />
          <circle cx="68" cy="53" r="5.5" fill="#5C3D2E" />
          <circle cx="53.5" cy="51.5" r="2" fill="white" />
          <circle cx="69.5" cy="51.5" r="2" fill="white" />
          {/* 작은 미소 */}
          <path d="M 52 73 Q 60 79 68 73" stroke="#5C3D2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}

      {mood === 'waiting' && (
        <>
          {/* 기다림 — 처진 눈썹 */}
          <path d="M 45 48 Q 52 44 57 47" stroke="#5C3D2E" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 63 47 Q 68 44 75 48" stroke="#5C3D2E" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* 반쯤 감긴 눈 */}
          <circle cx="52" cy="54" r="5.5" fill="#5C3D2E" />
          <circle cx="68" cy="54" r="5.5" fill="#5C3D2E" />
          <circle cx="53.5" cy="52.5" r="2" fill="white" />
          <circle cx="69.5" cy="52.5" r="2" fill="white" />
          {/* 평평한 입 */}
          <path d="M 52 75 Q 60 72 68 75" stroke="#5C3D2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* ZZZ */}
          <text x="80" y="36" fontSize="10" fill="#A0714F" opacity="0.55">z</text>
          <text x="89" y="27" fontSize="13" fill="#A0714F" opacity="0.45">z</text>
          <text x="100" y="18" fontSize="16" fill="#A0714F" opacity="0.35">Z</text>
        </>
      )}
    </svg>
  )
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

      const pendingActions = ACTION_ORDER.filter(
        (action) => data.status[action] && !data.reactions[action]
      )
      if (pendingActions.length > 0) {
        const action = pendingActions[pendingActions.length - 1]
        const reactRes = await fetch('/api/otter/react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_type: action }),
        })
        if (reactRes.ok) {
          const { reaction_text } = await reactRes.json()
          setLatestReaction(reaction_text)
          setState((prev) =>
            prev ? { ...prev, reactions: { ...prev.reactions, [action]: reaction_text } } : prev
          )
        }
      } else {
        const lastAction = ACTION_ORDER.filter((a) => data.reactions[a]).pop()
        if (lastAction) setLatestReaction(data.reactions[lastAction] ?? null)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
    const handler = () => fetchState()
    window.addEventListener('health-log-updated', handler)
    return () => window.removeEventListener('health-log-updated', handler)
  }, [fetchState])

  if (loading) {
    return (
      <div className="bg-[#FFF8F0] rounded-xl md:rounded-2xl p-5 border border-orange-100 shadow-sm animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-28 h-28 bg-orange-100 rounded-full" />
          <div className="h-4 w-20 bg-orange-100 rounded" />
          <div className="h-3 w-32 bg-orange-50 rounded" />
        </div>
      </div>
    )
  }

  if (!state) return null

  const mood: OtterMood =
    state.completedCount === 4 ? 'happy' :
    state.completedCount === 0 ? 'waiting' : 'normal'

  const moodSummary = getOtterMoodSummary(state.status)

  return (
    <div className="bg-[#FFF8F0] rounded-xl md:rounded-2xl p-5 border border-orange-100 shadow-sm">
      {/* 수달 일러스트 */}
      <div className="flex flex-col items-center mb-4">
        <div className="w-32 h-32">
          <OtterSVG mood={mood} />
        </div>
        <h3 className="mt-2 font-bold text-gray-800 text-lg">{state.name}</h3>
        <p className="text-xs text-orange-400 font-medium mt-0.5">
          오늘 {state.completedCount}/4 케어 완료
        </p>
      </div>

      {/* 말풍선 */}
      {latestReaction ? (
        <div className="mb-4 px-4 py-2.5 bg-white border border-orange-100 rounded-2xl text-sm text-gray-700 text-center shadow-sm">
          {latestReaction}
        </div>
      ) : (
        <div className="mb-4 px-4 py-2.5 bg-white border border-orange-100 rounded-2xl text-sm text-gray-400 text-center shadow-sm">
          오늘 기록을 남기면 {state.name}가 반응해요!
        </div>
      )}

      {/* 4개 상태 뱃지 (클릭하면 기록 모달 오픈) */}
      <div className="grid grid-cols-4 gap-2">
        {ACTION_ORDER.map((action) => {
          const done = state.status[action]
          return (
            <button
              key={action}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-health-log-modal', { detail: { action } }))}
              className={`flex flex-col items-center py-2.5 px-1 rounded-xl border transition-all active:scale-95 ${
                done ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 hover:border-orange-200 hover:bg-orange-50/50'
              }`}
            >
              <span className={`text-xl mb-1 ${done ? '' : 'grayscale opacity-35'}`}>
                {ACTION_EMOJI[action]}
              </span>
              <span className={`text-[10px] font-semibold leading-tight text-center ${
                done ? 'text-orange-500' : 'text-gray-300'
              }`}>
                {done ? OTTER_STATUS_LABELS[action].done : OTTER_STATUS_LABELS[action].pending}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center">{moodSummary}</p>

      {/* 기록 리스트 + 모달 (minimal: 카드 UI 없이 OtterCard 안에 통합) */}
      <div className="mt-3 pt-3 border-t border-orange-100">
        <HealthLogButtons minimal />
      </div>
    </div>
  )
}
