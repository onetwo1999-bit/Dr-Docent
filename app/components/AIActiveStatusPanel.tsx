'use client'

import { useState, useEffect } from 'react'
import { Bot } from 'lucide-react'

const DEFAULT_MESSAGE = '닥터도슨트AI 가 사용자님의 건강을 실시간으로 추적하고 있습니다.'

const CATEGORY_MESSAGES: Record<string, string> = {
  meal: '영양 밸런스 분석 중...',
  exercise: '운동 강도 점수 산출 중...',
  medication: '복약 이행 패턴 확인 중...',
  sleep: '수면·회복 패턴 분석 중...',
}

const PULSE_DURATION_MS = 4000

export default function AIActiveStatusPanel() {
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ category?: string }>).detail
      const category = detail?.category
      if (category && CATEGORY_MESSAGES[category]) {
        setMessage(CATEGORY_MESSAGES[category])
        setIsPulsing(true)
        const t = setTimeout(() => {
          setMessage(DEFAULT_MESSAGE)
          setIsPulsing(false)
        }, PULSE_DURATION_MS)
        return () => clearTimeout(t)
      }
    }
    window.addEventListener('health-log-updated', handler)
    return () => window.removeEventListener('health-log-updated', handler)
  }, [])

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-lg"
      style={{ marginLeft: 'max(0px, calc(100vw - 100%))' }}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl bg-[#2DD4BF]/10 transition-all ${
          isPulsing ? 'animate-ai-pulse' : ''
        }`}
      >
        <Bot className="w-5 h-5 text-[#2DD4BF]" />
      </div>
      <div className="min-w-0 max-w-[280px]">
        <p className="text-xs font-medium text-gray-500">닥터 도슨트 AI</p>
        <p className="text-sm font-medium text-gray-800 leading-snug">{message}</p>
      </div>
    </div>
  )
}
