'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Trophy, Medal, Award, Loader2, RefreshCw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export interface RankingEntry {
  rank: number
  chart_number_masked: string
  nickname: string
  score: number
}

export interface RankingMe {
  rank: number
  score: number
  chart_number_masked: string
}

const POLL_INTERVAL_MS = 20_000

/** 점수/순위 변경 시 숫자 카운트업 애니메이션 */
function AnimatedNumber({
  value,
  duration = 600,
  decimals = 0,
}: {
  value: number
  duration?: number
  decimals?: number
}) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === prevRef.current) return
    const start = prevRef.current
    const end = value
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const easeOut = 1 - (1 - t) * (1 - t)
      const current = start + (end - start) * easeOut
      setDisplay(current)
      if (t >= 1) prevRef.current = end
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}</>
}

export default function RankingBoard() {
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [me, setMe] = useState<RankingMe | null>(null)
  const [date, setDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRanking = useCallback(async () => {
    try {
      const res = await fetch('/api/ranking', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '랭킹을 불러올 수 없습니다.')
        setRanking([])
        setMe(null)
        return
      }
      setError(null)
      setRanking(data.ranking || [])
      setMe(data.me ?? null)
      setDate(data.date || '')
    } catch (e) {
      setError('네트워크 오류가 발생했습니다.')
      setRanking([])
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRanking()
  }, [fetchRanking])

  useEffect(() => {
    const id = setInterval(fetchRanking, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchRanking])

  // Realtime: health_scores 변경 시 즉시 업데이트
  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)
    
    const channel = supabase
      .channel('ranking-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'health_scores',
          filter: `score_date=eq.${today}`,
        },
        () => {
          fetchRanking()
        }
      )
      .subscribe()
    
    // 커스텀 이벤트도 리스닝 (다른 컴포넌트에서 트리거 가능)
    const handleRankingUpdate = () => fetchRanking()
    window.addEventListener('ranking-updated', handleRankingUpdate)
    
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('ranking-updated', handleRankingUpdate)
    }
  }, [fetchRanking])

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-500" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />
    return <span className="text-sm font-semibold text-gray-400 w-5 text-center">{rank}</span>
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-[#2DD4BF] animate-spin" />
        <p className="mt-3 text-sm text-gray-500">랭킹 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/50">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">실시간 건강 랭킹</h2>
        <p className="text-sm md:text-base text-gray-600 mt-1">
          {date ? `${date} 기준 · 상위 10명` : '상위 10명'}
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-amber-50 text-amber-800 text-sm border-b border-amber-100">
          {error}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {ranking.length === 0 && !error && (
          <li className="px-4 py-8 text-center text-gray-500 text-sm">
            아직 기록이 없어요. 첫 기록을 남겨보세요.
          </li>
        )}
        {ranking.map((entry) => (
          <li
            key={`${entry.rank}-${entry.chart_number_masked}`}
            className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center justify-center w-8 shrink-0">
              {rankIcon(entry.rank)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-mono text-base md:text-lg font-semibold text-gray-800">
                {entry.chart_number_masked}
              </span>
              {entry.nickname && entry.nickname !== '회원' && (
                <span className="ml-2 text-sm text-gray-600">{entry.nickname}</span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="text-[#2DD4BF] font-bold text-lg md:text-xl tabular-nums">
                <AnimatedNumber value={entry.score} duration={600} decimals={2} />
              </span>
              <span className="text-gray-600 text-sm ml-1">점</span>
            </div>
          </li>
        ))}
      </ul>

      {me && (
        <div className="mt-2 mx-5 mb-5 p-5 rounded-xl bg-[#2DD4BF]/10 border-2 border-[#2DD4BF]/40">
          <p className="text-sm md:text-base font-bold text-[#2DD4BF] uppercase tracking-wide mb-3">
            내 순위
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-mono text-base md:text-lg font-bold text-gray-900">
                {me.chart_number_masked}
              </span>
              <span className="text-gray-700 text-base md:text-lg font-semibold">
                <AnimatedNumber value={me.rank} duration={600} decimals={0} />위
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl md:text-3xl font-bold text-[#2DD4BF] tabular-nums">
                <AnimatedNumber value={me.score} duration={600} decimals={2} />
              </span>
              <span className="text-gray-700 text-base md:text-lg ml-2 font-medium">점</span>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            fetchRanking().finally(() => setLoading(false))
          }}
          className="inline-flex items-center gap-2 text-sm md:text-base text-gray-600 hover:text-[#2DD4BF] transition-colors font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>
    </div>
  )
}
