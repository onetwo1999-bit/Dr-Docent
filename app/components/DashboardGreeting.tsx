'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

/** 유저 로컬 시간대 기준 아침/오후/저녁 인사말 (3040 부모님 건강 걱정 유저 공감 톤) */
function getDynamicGreeting(): { greeting: string; subtitle: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return {
      greeting: '오늘도 건강한 아침이에요',
      subtitle: '나와 가족을 위해 오늘도 한 걸음씩 챙겨보아요',
    }
  }
  if (hour >= 12 && hour < 18) {
    return {
      greeting: '따뜻한 오후 보내세요',
      subtitle: '몸과 마음이 편한 하루 되세요',
    }
  }
  return {
    greeting: '오늘 하루 수고 많으셨어요',
    subtitle: '편안한 저녁 보내시고, 내일도 건강한 하루 되세요',
  }
}

interface DashboardGreetingProps {
  userId: string
  initialNickname: string | null
  emailPrefix: string
  chartNumber: string
  /** 서버 초기값 (클라이언트에서 시간대별로 덮어씀) */
  greeting?: string
}

export default function DashboardGreeting({
  userId,
  initialNickname,
  emailPrefix,
  chartNumber,
}: DashboardGreetingProps) {
  const displayName = (nick: string | null) => nick?.trim() || emailPrefix
  const { greeting, subtitle } = getDynamicGreeting()

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
            차트 #{chartNumber}
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
            {displayName(nickname)}님, {greeting}! ✨
          </h1>
          <p className="text-gray-600 text-sm md:text-base mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}
