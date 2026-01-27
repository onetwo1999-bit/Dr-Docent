'use client'

import { useState, useEffect } from 'react'
import { Clock, TrendingUp } from 'lucide-react'

interface FastingTrackerProps {
  userId: string
}

export default function FastingTracker({ userId }: FastingTrackerProps) {
  const [fastingHours, setFastingHours] = useState<number | null>(null)
  const [lastMealTime, setLastMealTime] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLastMeal()
    const interval = setInterval(() => {
      fetchLastMeal()
    }, 60000) // 1분마다 업데이트

    return () => clearInterval(interval)
  }, [userId])

  const fetchLastMeal = async () => {
    try {
      const response = await fetch('/api/health-logs?category=meal')
      const data = await response.json()
      
      if (data.success && data.data && data.data.length > 0) {
        // 가장 최근 식사 기록 찾기
        const sortedMeals = data.data
          .filter((log: any) => log.category === 'meal')
          .sort((a: any, b: any) => 
            new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
          )
        
        if (sortedMeals.length > 0) {
          const lastMeal = sortedMeals[0]
          const mealTime = new Date(lastMeal.logged_at)
          const now = new Date()
          const hoursDiff = (now.getTime() - mealTime.getTime()) / (1000 * 60 * 60)
          
          setLastMealTime(mealTime.toISOString())
          setFastingHours(Math.floor(hoursDiff))
        } else {
          setFastingHours(null)
          setLastMealTime(null)
        }
      } else {
        setFastingHours(null)
        setLastMealTime(null)
      }
    } catch (error) {
      console.error('공복 시간 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return null
  }

  if (fastingHours === null) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm text-gray-600">식사 기록이 없어요</p>
            <p className="text-xs text-gray-400">식사 기록을 남겨주세요</p>
          </div>
        </div>
      </div>
    )
  }

  const getFastingMessage = () => {
    if (fastingHours < 12) {
      return `선생님, 현재 ${fastingHours}시간 공복 유지 중이에요. 저속 노화를 위해 다음 식사는 언제 하실 예정인가요?`
    } else if (fastingHours < 16) {
      return `선생님, ${fastingHours}시간 공복 유지 중이에요. 간헐적 단식 효과가 나타나고 있어요!`
    } else {
      return `선생님, ${fastingHours}시간 공복 유지 중이에요. 장기간 공복은 전문가 상담을 권장드려요.`
    }
  }

  return (
    <div className="bg-gradient-to-br from-[#2DD4BF]/10 to-[#2DD4BF]/5 rounded-xl p-4 border border-[#2DD4BF]/20">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#2DD4BF]/20 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-[#2DD4BF]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">공복 시간</span>
            <span className="text-lg font-bold text-[#2DD4BF]">{fastingHours}시간</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            {getFastingMessage()}
          </p>
        </div>
      </div>
    </div>
  )
}
