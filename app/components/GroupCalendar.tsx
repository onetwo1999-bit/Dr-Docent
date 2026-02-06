'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, ArrowLeft, Users, Stethoscope } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

export interface GroupCalendarProps {
  groupId: string
  groupName?: string
}

type DayActivity = { meal: boolean; exercise: boolean; medication: boolean }

/** 수치 데이터 없이 기록 여부만 표시: 💊 복약, 🏋️ 운동, 🥗 식단 */
const ICON_MEAL = '🥗'
const ICON_EXERCISE = '🏋️'
const ICON_MEDICATION = '💊'

function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
  }
}

export default function GroupCalendar({ groupId, groupName }: GroupCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [days, setDays] = useState<Record<string, DayActivity>>({})
  const [summary, setSummary] = useState<string>('')
  const [aiBriefing, setAiBriefing] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCalendar = useCallback(async () => {
    if (!groupId) return
    setIsLoading(true)
    setError(null)
    try {
      const { start, end } = getMonthRange(currentDate)
      const res = await fetch(
        `/api/group-calendar?group_id=${encodeURIComponent(groupId)}&start_date=${start}&end_date=${end}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '조회에 실패했습니다.')
        setDays({})
        setSummary('')
        setAiBriefing('')
        return
      }
      setDays(data.days || {})
      setSummary(data.summary || '')
      setAiBriefing(data.ai_briefing || '')
    } catch (e) {
      console.error('[GroupCalendar] fetch error:', e)
      setError('네트워크 오류가 발생했습니다.')
      setDays({})
      setSummary('')
      setAiBriefing('')
    } finally {
      setIsLoading(false)
    }
  }, [groupId, currentDate])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  // Supabase Realtime: 그룹원이 기록을 추가하면 캘린더 갱신
  useEffect(() => {
    if (!groupId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`group-calendar:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_activity_events',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          fetchCalendar()
        }
      )
      .subscribe()
    
    // 커스텀 이벤트도 리스닝
    const handleGroupUpdate = () => fetchCalendar()
    window.addEventListener('group-calendar-updated', handleGroupUpdate)
    
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('group-calendar-updated', handleGroupUpdate)
    }
  }, [groupId, fetchCalendar])

  const navigate = (direction: 'prev' | 'next') => {
    const next = new Date(currentDate)
    next.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentDate(next)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const grid: { date: Date; isToday: boolean; isCurrentMonth: boolean }[][] = []
  let week: { date: Date; isToday: boolean; isCurrentMonth: boolean }[] = []

  for (let i = 0; i < firstDay.getDay(); i++) {
    const date = new Date(year, month, -firstDay.getDay() + i + 1)
    week.push({ date, isToday: false, isCurrentMonth: false })
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day)
    date.setHours(0, 0, 0, 0)
    week.push({
      date,
      isToday: date.getTime() === today.getTime(),
      isCurrentMonth: true,
    })
    if (week.length === 7) {
      grid.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    let nextDay = 1
    while (week.length < 7) {
      const date = new Date(year, month + 1, nextDay++)
      week.push({ date, isToday: false, isCurrentMonth: false })
    }
    grid.push(week)
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-[#2DD4BF] transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 md:w-8 md:h-8 text-[#2DD4BF]" />
              그룹 캘린더
            </h1>
            <p className="text-base md:text-lg text-gray-600">
              {groupName ? `${groupName} · 활동만 공유돼요` : '그룹원의 활동 여부만 아이콘으로 표시돼요'}
            </p>
          </div>
        </div>
      </div>

      {/* 아이콘 범례: 수치 없이 기록 여부만 표시 */}
      <div className="mb-5 flex flex-wrap items-center gap-4 text-base md:text-lg text-gray-700">
        <span className="font-bold text-gray-900">표시 의미</span>
        <span className="font-medium"><span className="mr-1 text-xl">🥗</span> 식단 기록</span>
        <span className="font-medium"><span className="mr-1 text-xl">🏋️</span> 운동 기록</span>
        <span className="font-medium"><span className="mr-1 text-xl">💊</span> 복약 기록</span>
        <span className="text-gray-600">· 수치·민감 정보는 노출되지 않습니다</span>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 min-w-[200px] text-center">
            {currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </h2>
          <button
            type="button"
            onClick={() => navigate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToToday}
          className="px-5 py-2.5 text-base md:text-lg font-semibold text-[#2DD4BF] hover:bg-[#2DD4BF]/10 rounded-lg transition-colors"
        >
          오늘
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
        </div>
      )}

      {!isLoading && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div
                key={day}
                className={`p-3 text-center text-sm font-medium ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          {grid.map((week, weekIdx) => (
            <div
              key={weekIdx}
              className="grid grid-cols-7 border-b border-gray-100 last:border-b-0"
            >
              {week.map((cell, dayIdx) => {
                const dateStr = toLocalDateString(cell.date)
                const activity = days[dateStr]
                return (
                  <div
                    key={dayIdx}
                    className={`
                      min-h-[100px] p-2 border-r border-gray-100 last:border-r-0
                      ${!cell.isCurrentMonth ? 'bg-gray-50/50' : ''}
                    `}
                  >
                    <div
                      className={`
                        text-sm font-medium mb-1
                        ${cell.isToday ? 'w-7 h-7 bg-[#2DD4BF] text-white rounded-full flex items-center justify-center' : ''}
                        ${!cell.isCurrentMonth ? 'text-gray-300' : dayIdx === 0 ? 'text-red-500' : dayIdx === 6 ? 'text-blue-500' : 'text-gray-700'}
                      `}
                    >
                      {cell.date.getDate()}
                    </div>
                    {activity && (activity.meal || activity.exercise || activity.medication) && (
                      <div className="flex flex-wrap gap-1.5 mt-2" title="그룹 활동">
                        {activity.meal && <span className="text-xl md:text-2xl" title="식단">🥗</span>}
                        {activity.exercise && <span className="text-xl md:text-2xl" title="운동">🏋️</span>}
                        {activity.medication && <span className="text-xl md:text-2xl" title="복약">💊</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* 닥터 도슨트의 그룹 건강 요약 */}
      {(aiBriefing || summary) && !isLoading && (
        <section className="mt-8 rounded-2xl border-2 border-[#2DD4BF]/30 bg-gradient-to-b from-[#2DD4BF]/5 to-white p-6 md:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Stethoscope className="w-6 h-6 md:w-7 md:h-7 text-[#2DD4BF]" />
            <h3 className="text-xl md:text-2xl font-bold text-gray-900">닥터 도슨트의 그룹 건강 요약</h3>
          </div>
          <p className="text-base md:text-lg text-gray-800 leading-relaxed font-medium">
            {aiBriefing || summary}
          </p>
        </section>
      )}
    </div>
  )
}
