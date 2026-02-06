'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Pill, Footprints, Utensils, AlertCircle, ThumbsUp, Stethoscope } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from './Toast'

export interface GroupSafetyCalendarProps {
  groupId: string
}

type DayActivity = { meal: boolean; exercise: boolean; medication: boolean }

type Member = {
  chart_number: string
  nickname: string
  isOwn: boolean
}

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

export default function GroupSafetyCalendar({ groupId }: GroupSafetyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [days, setDays] = useState<Record<string, DayActivity>>({})
  const [aiComment, setAiComment] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast, ToastComponent } = useToast()

  // 멤버 목록 조회
  const fetchMembers = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다.')
        setIsLoading(false)
        return
      }

      // 현재 사용자 차트 번호
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('chart_number')
        .eq('id', user.id)
        .single()

      if (!currentProfile?.chart_number) {
        setError('차트 번호가 없습니다.')
        setIsLoading(false)
        return
      }

      // 그룹 정보 조회
      const { data: group } = await supabase
        .from('user_groups')
        .select('member_chart_numbers')
        .eq('group_id', groupId)
        .single()

      if (!group || !group.member_chart_numbers || group.member_chart_numbers.length === 0) {
        setError('그룹 멤버를 찾을 수 없습니다.')
        setIsLoading(false)
        return
      }

      // 멤버 프로필 조회
      const { data: profiles } = await supabase
        .from('profiles')
        .select('chart_number, nickname')
        .in('chart_number', group.member_chart_numbers)

      const memberList: Member[] = (profiles || []).map(p => ({
        chart_number: p.chart_number || '',
        nickname: p.nickname || '회원',
        isOwn: p.chart_number === currentProfile.chart_number
      }))

      // "나"를 맨 앞으로
      memberList.sort((a, b) => {
        if (a.isOwn) return -1
        if (b.isOwn) return 1
        return 0
      })

      setMembers(memberList)
      if (memberList.length > 0) {
        setSelectedMember(memberList[0])
      }
      setIsLoading(false)
    } catch (e) {
      console.error('[GroupSafetyCalendar] 멤버 조회 에러:', e)
      setError('멤버 목록을 불러오는데 실패했습니다.')
      setIsLoading(false)
    }
  }, [groupId])

  // 선택된 멤버의 캘린더 데이터 조회
  const fetchCalendar = useCallback(async () => {
    if (!selectedMember) return

    setIsLoadingCalendar(true)
    setError(null)
    try {
      const { start, end } = getMonthRange(currentDate)
      const res = await fetch(
        `/api/group-calendar/member?member_chart_number=${encodeURIComponent(selectedMember.chart_number)}&start_date=${start}&end_date=${end}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '조회에 실패했습니다.')
        setDays({})
        setAiComment('')
        return
      }
      setDays(data.days || {})
      setAiComment(data.aiComment || '')
    } catch (e) {
      console.error('[GroupSafetyCalendar] 캘린더 조회 에러:', e)
      setError('네트워크 오류가 발생했습니다.')
      setDays({})
      setAiComment('')
    } finally {
      setIsLoadingCalendar(false)
    }
  }, [selectedMember, currentDate])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    if (selectedMember) {
      fetchCalendar()
    }
  }, [selectedMember, fetchCalendar])

  // Supabase Realtime: 그룹원이 기록을 추가하면 캘린더 갱신
  useEffect(() => {
    if (!groupId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`group-safety-calendar:${groupId}`)
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

  const handleEncourage = () => {
    if (selectedMember && !selectedMember.isOwn) {
      showToast('응원을 보냈습니다', 'success')
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
      </div>
    )
  }

  if (error && !selectedMember) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <p className="text-gray-500 text-lg">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* 멤버 탭 */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          {members.map((member) => (
            <button
              key={member.chart_number}
              onClick={() => setSelectedMember(member)}
              className={`
                px-6 py-3 rounded-xl text-lg font-semibold transition-all
                ${selectedMember?.chart_number === member.chart_number
                  ? 'bg-[#2DD4BF] text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-[#2DD4BF] hover:text-[#2DD4BF]'
                }
              `}
            >
              {member.isOwn ? '나' : `[${member.nickname}]`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-base">
          {error}
        </div>
      )}

      {/* 캘린더 헤더 */}
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

      {/* 아이콘 그리드 캘린더 */}
      {isLoadingCalendar ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
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
                        text-sm font-medium mb-2
                        ${cell.isToday ? 'w-7 h-7 bg-[#2DD4BF] text-white rounded-full flex items-center justify-center' : ''}
                        ${!cell.isCurrentMonth ? 'text-gray-300' : dayIdx === 0 ? 'text-red-500' : dayIdx === 6 ? 'text-blue-500' : 'text-gray-700'}
                      `}
                    >
                      {cell.date.getDate()}
                    </div>
                    {activity && (
                      <div className="flex flex-col gap-1.5">
                        {/* 복약: 완료(초록) / 미복용(빨강) */}
                        {activity.medication ? (
                          <div className="flex items-center justify-center">
                            <Pill className="w-5 h-5 text-green-500" title="복약 완료" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-400" title="복약 미완료" />
                          </div>
                        )}
                        {/* 운동: 달성(파랑) / 미달성(회색) */}
                        {activity.exercise ? (
                          <div className="flex items-center justify-center">
                            <Footprints className="w-5 h-5 text-blue-500" title="운동 달성" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-gray-300" title="운동 미달성" />
                          </div>
                        )}
                        {/* 식단: 기록(주황) */}
                        {activity.meal && (
                          <div className="flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-orange-500" title="식단 기록" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* 닥터 도슨의 코멘트 + 응원 보내기 */}
      {aiComment && !isLoadingCalendar && (
        <section className="mt-6 rounded-2xl border-2 border-[#2DD4BF]/30 bg-gradient-to-b from-[#2DD4BF]/5 to-white p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Stethoscope className="w-6 h-6 md:w-7 md:h-7 text-[#2DD4BF]" />
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">닥터 도슨의 코멘트</h3>
              </div>
              <p className="text-base md:text-lg text-gray-800 leading-relaxed font-medium">
                {aiComment}
              </p>
            </div>
            {selectedMember && !selectedMember.isOwn && (
              <button
                onClick={handleEncourage}
                className="flex items-center gap-2 px-5 py-3 bg-[#2DD4BF] hover:bg-[#2DD4BF]/90 text-white rounded-xl font-semibold text-base md:text-lg transition-colors shadow-lg whitespace-nowrap"
              >
                <ThumbsUp className="w-5 h-5" />
                응원 보내기
              </button>
            )}
          </div>
        </section>
      )}

      {ToastComponent}
    </div>
  )
}
