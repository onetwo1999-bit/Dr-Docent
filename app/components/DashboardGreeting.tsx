'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface DashboardGreetingProps {
  userId: string
  /** profiles.nickname (서버에서 조회한 초기값) */
  initialNickname: string | null
  /** 이메일 앞부분 — nickname 없을 때 폴백 */
  emailPrefix: string
  chartNumber: string
  greeting: string
}

export default function DashboardGreeting({
  userId,
  initialNickname,
  emailPrefix,
  chartNumber,
  greeting,
}: DashboardGreetingProps) {
  const displayName = (nick: string | null) => nick?.trim() || emailPrefix

  const [nickname, setNickname] = useState<string | null>(initialNickname)

  useEffect(() => {
    const supabase = createClient()

    // Realtime 구독 — 현재 유저의 profiles 행 변경 감지
    const channel = supabase
      .channel(`profiles:id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newNickname = (payload.new as { nickname?: string | null }).nickname ?? null
          setNickname(newNickname)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center text-2xl">
          😊
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#2DD4BF] text-sm md:text-base font-semibold">
            차트 #{chartNumber} 선생님
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
            {displayName(nickname)}님, {greeting}! ✨
          </h1>
          <p className="text-gray-600 text-sm md:text-base mt-0.5">
            오늘 컨디션은 어떠세요?
          </p>
        </div>
      </div>
    </div>
  )
}
