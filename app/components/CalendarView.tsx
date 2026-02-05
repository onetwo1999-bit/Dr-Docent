'use client'

import { useState, useEffect } from 'react'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Utensils,
  Dumbbell,
  Pill,
  Heart,
  Plus,
  X,
  Check,
  Loader2,
  ArrowLeft,
  Pencil,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import type { HealthLogItem } from './HealthLogButtons'
import MealLogModal from './MealLogModal'
import ExerciseLogModal from './ExerciseLogModal'
import MedicationLogModal from './MedicationLogModal'

type ViewType = 'month' | 'week' | 'day'
type CategoryType = 'meal' | 'exercise' | 'medication' | 'cycle'

interface HealthLog {
  id: string
  category: string
  sub_type?: string
  logged_at: string
  note?: string | null
  image_url?: string
  [key: string]: unknown
}

interface CycleLog {
  id: string
  start_date: string
  end_date: string | null
  cycle_length: number | null
}

interface DayData {
  date: Date
  logs: HealthLog[]
  isToday: boolean
  isCurrentMonth: boolean
}

interface CalendarViewProps {
  userId: string
}

// 카테고리별 아이콘 및 색상 (시그니처 컬러 #2DD4BF 사용)
const categoryConfig: Record<CategoryType, { 
  icon: (props?: { className?: string }) => React.ReactNode
  color: string
  label: string
}> = {
  meal: { 
    icon: (props) => <Utensils className={props?.className || "w-3.5 h-3.5"} />, 
    color: 'text-[#2DD4BF]', 
    label: '식사' 
  },
  exercise: { 
    icon: (props) => <Dumbbell className={props?.className || "w-3.5 h-3.5"} />, 
    color: 'text-[#2DD4BF]', 
    label: '운동' 
  },
  medication: { 
    icon: (props) => <Pill className={props?.className || "w-3.5 h-3.5"} />, 
    color: 'text-[#2DD4BF]', 
    label: '복약' 
  },
  cycle: { 
    icon: (props) => <Heart className={props?.className || "w-3.5 h-3.5"} />, 
    color: 'text-[#FF6B9D]', // 그날은 따뜻한 핑크 톤으로 구분
    label: '그날' 
  }
}

// 시간 포맷팅
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

// 날짜 포맷팅
const formatDate = (date: Date) => {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function CalendarView({ userId }: CalendarViewProps) {
  const [viewType, setViewType] = useState<ViewType>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState<HealthLog[]>([])
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingLog, setEditingLog] = useState<HealthLogItem | null>(null)
  const [editModalCategory, setEditModalCategory] = useState<CategoryType | null>(null)
  const [popoverTarget, setPopoverTarget] = useState<{ date: Date; category: CategoryType } | null>(null)
  /** 캘린더에서 "기록 추가" 후 항목 선택 시, 상세 입력 모달을 열기 위한 카테고리 */
  const [addDetailCategory, setAddDetailCategory] = useState<CategoryType | null>(null)
  const [cycleAddSubmitting, setCycleAddSubmitting] = useState(false)

  // 데이터 로드
  useEffect(() => {
    fetchLogs()
  }, [currentDate, viewType])

  // 실시간 동기화: cycle 및 health-log 업데이트 이벤트 리스너
  useEffect(() => {
    const handleUpdate = () => {
      fetchLogs()
    }
    window.addEventListener('cycle-updated', handleUpdate)
    window.addEventListener('health-log-updated', handleUpdate)
    return () => {
      window.removeEventListener('cycle-updated', handleUpdate)
      window.removeEventListener('health-log-updated', handleUpdate)
    }
  }, [])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const { startDate, endDate } = getDateRange()
      
      // health_logs 조회
      const healthResponse = await fetch(
        `/api/health-logs?start_date=${startDate}&end_date=${endDate}`
      )
      const healthData = await healthResponse.json()
      if (healthData.success) {
        setLogs(healthData.data || [])
      }

      // cycle_logs 조회
      const cycleResponse = await fetch('/api/cycle-logs')
      const cycleData = await cycleResponse.json()
      if (cycleData.success && cycleData.data?.cycles) {
        setCycleLogs(cycleData.data.cycles || [])
      }
    } catch (error) {
      console.error('로그 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 날짜 범위 계산
  const getDateRange = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    if (viewType === 'month') {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    } else if (viewType === 'week') {
      const dayOfWeek = currentDate.getDay()
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() - dayOfWeek)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      }
    } else {
      const dateStr = currentDate.toISOString().split('T')[0]
      return { startDate: dateStr, endDate: dateStr }
    }
  }

  // 이전/다음 이동
  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewType === 'month') {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
    } else if (viewType === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  // 오늘로 이동
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // 월간 뷰용 날짜 그리드 생성
  const getMonthGrid = (): DayData[][] => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const grid: DayData[][] = []
    let week: DayData[] = []

    // 이전 달 날짜 채우기
    for (let i = 0; i < firstDay.getDay(); i++) {
      const date = new Date(year, month, -firstDay.getDay() + i + 1)
      week.push({
        date,
        logs: getLogsForDate(date),
        isToday: false,
        isCurrentMonth: false
      })
    }

    // 현재 달 날짜
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      week.push({
        date,
        logs: getLogsForDate(date),
        isToday: date.getTime() === today.getTime(),
        isCurrentMonth: true
      })

      if (week.length === 7) {
        grid.push(week)
        week = []
      }
    }

    // 다음 달 날짜 채우기
    if (week.length > 0) {
      const nextMonth = month + 1
      let nextDay = 1
      while (week.length < 7) {
        const date = new Date(year, nextMonth, nextDay++)
        week.push({
          date,
          logs: getLogsForDate(date),
          isToday: false,
          isCurrentMonth: false
        })
      }
      grid.push(week)
    }

    return grid
  }

  // 특정 날짜의 로그 가져오기 (health_logs + cycle_logs 통합)
  const getLogsForDate = (date: Date): HealthLog[] => {
    const dateStr = date.toISOString().split('T')[0]
    const healthLogsForDate = logs.filter(log => log.logged_at.startsWith(dateStr))
    
    // cycle_logs에서 해당 날짜에 시작일이 있는지 확인 (status가 'ongoing'이거나 'completed'인 경우)
    const cycleLogsForDate = cycleLogs
      .filter(cycle => {
        const cycleStart = cycle.start_date.split('T')[0]
        return cycleStart === dateStr
      })
      .map(cycle => ({
        id: cycle.id,
        category: 'cycle',
        logged_at: cycle.start_date,
        note: null as string | null | undefined
      } as HealthLog))
    
    return [...healthLogsForDate, ...cycleLogsForDate]
  }

  // 시간별 그리드 (일간/주간 뷰용)
  const getHourlySlots = () => {
    const slots = []
    for (let hour = 6; hour <= 22; hour++) {
      slots.push({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`
      })
    }
    return slots
  }

  // 주간 뷰용 날짜 배열
  const getWeekDays = () => {
    const days = []
    const dayOfWeek = currentDate.getDay()
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - dayOfWeek)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }
    return days
  }

  // 캘린더에서 "기록 추가" → 항목 클릭 시 상세 모달 열기 (즉시 저장하지 않음)
  const handleOpenDetailModal = (category: CategoryType) => {
    setShowAddModal(false)
    setAddDetailCategory(category)
  }

  // 그날(cycle) 시작 기록 (캘린더에서 선택한 날짜로)
  const handleCycleStartFromCalendar = async () => {
    if (!selectedDate) return
    setCycleAddSubmitting(true)
    try {
      const startDate = selectedDate.toISOString().split('T')[0]
      const res = await fetch('/api/cycle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'start', start_date: startDate })
      })
      const data = await res.json()
      if (data.success) {
        fetchLogs()
        setAddDetailCategory(null)
        window.dispatchEvent(new Event('cycle-updated'))
      } else {
        alert(data.error || '그날 시작 기록에 실패했습니다.')
      }
    } catch (err) {
      console.error('그날 기록 실패:', err)
      alert('기록 중 오류가 발생했습니다.')
    } finally {
      setCycleAddSubmitting(false)
    }
  }

  // 수정: 해당 카테고리 모달 열기 (기존 데이터 채움)
  const handleEditLog = (e: React.MouseEvent, log: HealthLog) => {
    e.stopPropagation()
    if (log.category === 'cycle') return
    setEditingLog(log as HealthLogItem)
    setEditModalCategory(log.category as CategoryType)
    setShowAddModal(false)
  }

  // 삭제: 확인 후 API 호출 (health_logs 또는 cycle_logs)
  const handleDeleteLog = async (e: React.MouseEvent, log: HealthLog) => {
    e.stopPropagation()
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      const isCycle = log.category === 'cycle'
      const url = isCycle
        ? `/api/cycle-logs?id=${encodeURIComponent(log.id)}`
        : `/api/health-logs?id=${encodeURIComponent(log.id)}`
      const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        fetchLogs()
        setEditingLog(null)
        setEditModalCategory(null)
        if (isCycle) window.dispatchEvent(new Event('cycle-updated'))
        else window.dispatchEvent(new Event('health-log-updated'))
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error('삭제 실패:', err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 헤더 제목
  const getHeaderTitle = () => {
    if (viewType === 'month') {
      return currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
    } else if (viewType === 'week') {
      const weekDays = getWeekDays()
      const start = weekDays[0].toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      const end = weekDays[6].toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      return `${start} - ${end}`
    } else {
      return formatDate(currentDate)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-[#2DD4BF]">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">건강 캘린더</h1>
            <p className="text-sm text-gray-400">기록을 한눈에 확인하세요</p>
          </div>
        </div>

        {/* 뷰 전환 탭 */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['month', 'week', 'day'] as ViewType[]).map((type) => (
            <button
              key={type}
              onClick={() => setViewType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewType === type
                  ? 'bg-white text-[#2DD4BF] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {type === 'month' ? '월' : type === 'week' ? '주' : '일'}
            </button>
          ))}
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
            {getHeaderTitle()}
          </h2>
          <button
            onClick={() => navigate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <button
          onClick={goToToday}
          className="px-4 py-2 text-sm font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/10 rounded-lg transition-colors"
        >
          오늘
        </button>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
        </div>
      )}

      {/* 월간 뷰 */}
      {!isLoading && viewType === 'month' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* 요일 헤더 */}
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

          {/* 날짜 그리드 */}
          {getMonthGrid().map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
              {week.map((dayData, dayIdx) => (
                <div
                  key={dayIdx}
                  onClick={() => {
                    setSelectedDate(dayData.date)
                    setShowAddModal(true)
                  }}
                  className={`
                    min-h-[100px] p-2 border-r border-gray-100 last:border-r-0 cursor-pointer
                    hover:bg-gray-50 transition-colors
                    ${!dayData.isCurrentMonth ? 'bg-gray-50/50' : ''}
                  `}
                >
                  <div className={`
                    text-sm font-medium mb-1
                    ${dayData.isToday ? 'w-7 h-7 bg-[#2DD4BF] text-white rounded-full flex items-center justify-center' : ''}
                    ${!dayData.isCurrentMonth ? 'text-gray-300' : dayIdx === 0 ? 'text-red-500' : dayIdx === 6 ? 'text-blue-500' : 'text-gray-700'}
                  `}>
                    {dayData.date.getDate()}
                  </div>
                  
                  {/* 카테고리별 아이콘 마커 (아이콘 클릭 시 해당 일의 수정/삭제 팝오버) */}
                  {dayData.logs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Object.entries(
                        dayData.logs.reduce((acc, log) => {
                          acc[log.category] = (acc[log.category] || 0) + 1
                          return acc
                        }, {} as Record<string, number>)
                      ).map(([category, count]) => {
                        const config = categoryConfig[category as CategoryType]
                        if (!config) return null
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPopoverTarget({ date: dayData.date, category: category as CategoryType })
                            }}
                            className={`flex items-center justify-center ${config.color} transition-opacity hover:opacity-80 cursor-pointer rounded p-0.5`}
                            title={`${config.label} ${count}회 - 클릭하여 수정/삭제`}
                          >
                            {config.icon({ className: "w-3.5 h-3.5" })}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 주간 뷰 */}
      {!isLoading && viewType === 'week' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-100">
            <div className="p-3 text-center text-sm font-medium text-gray-400">시간</div>
            {getWeekDays().map((date, i) => {
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div
                  key={i}
                  className={`p-3 text-center ${isToday ? 'bg-[#2DD4BF]/10' : ''}`}
                >
                  <div className={`text-xs ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                    {['일', '월', '화', '수', '목', '금', '토'][i]}
                  </div>
                  <div className={`text-lg font-semibold ${isToday ? 'text-[#2DD4BF]' : 'text-gray-700'}`}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 시간별 그리드 */}
          <div className="max-h-[600px] overflow-y-auto">
            {getHourlySlots().map((slot) => (
              <div key={slot.hour} className="grid grid-cols-8 border-b border-gray-100">
                <div className="p-2 text-xs text-gray-400 text-right pr-4 border-r border-gray-100">
                  {slot.label}
                </div>
                {getWeekDays().map((date, dayIdx) => {
                  const dayLogs = getLogsForDate(date).filter(log => {
                    const logHour = new Date(log.logged_at).getHours()
                    return logHour === slot.hour
                  })
                  const isToday = date.toDateString() === new Date().toDateString()
                  
                  return (
                    <div
                      key={dayIdx}
                      onClick={() => {
                        const newDate = new Date(date)
                        newDate.setHours(slot.hour, 0, 0, 0)
                        setSelectedDate(newDate)
                        setShowAddModal(true)
                      }}
                      className={`
                        min-h-[60px] p-1 border-r border-gray-100 last:border-r-0
                        hover:bg-gray-50 cursor-pointer transition-colors
                        ${isToday ? 'bg-[#2DD4BF]/5' : ''}
                      `}
                    >
                      {dayLogs.map((log) => {
                        const config = categoryConfig[log.category as CategoryType]
                        if (!config) return null
                        const canEdit = log.category !== 'cycle'
                        return (
                          <div
                            key={log.id}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs p-1.5 rounded-lg mb-1 bg-white border border-gray-200 ${config.color} flex items-center gap-1.5`}
                          >
                            {config.icon({ className: "w-3 h-3" })}
                            <span className="text-gray-700 font-medium flex-1">{config.label}</span>
                            {canEdit && (
                              <>
                                <button type="button" onClick={(e) => handleEditLog(e, log)} className="p-0.5 text-gray-400 hover:text-[#2DD4BF]" title="수정"><Pencil className="w-3 h-3" /></button>
                                <button type="button" onClick={(e) => handleDeleteLog(e, log)} className="p-0.5 text-gray-400 hover:text-red-500" title="삭제"><Trash2 className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일간 뷰 */}
      {!isLoading && viewType === 'day' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            {getHourlySlots().map((slot) => {
              const hourLogs = getLogsForDate(currentDate).filter(log => {
                const logHour = new Date(log.logged_at).getHours()
                return logHour === slot.hour
              })
              const isCurrentHour = new Date().getHours() === slot.hour && 
                currentDate.toDateString() === new Date().toDateString()
              
              return (
                <div
                  key={slot.hour}
                  onClick={() => {
                    const newDate = new Date(currentDate)
                    newDate.setHours(slot.hour, 0, 0, 0)
                    setSelectedDate(newDate)
                    setShowAddModal(true)
                  }}
                  className={`
                    flex border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors
                    ${isCurrentHour ? 'bg-[#2DD4BF]/10' : ''}
                  `}
                >
                  <div className={`w-20 p-4 text-sm border-r border-gray-100 ${isCurrentHour ? 'text-[#2DD4BF] font-semibold' : 'text-gray-400'}`}>
                    {slot.label}
                  </div>
                  <div className="flex-1 p-2 min-h-[80px]">
                    {hourLogs.map((log) => {
                      const config = categoryConfig[log.category as CategoryType]
                      if (!config) return null
                      const canEdit = log.category !== 'cycle'
                      return (
                        <div
                          key={log.id}
                          onClick={(e) => e.stopPropagation()}
                          className="p-3 rounded-xl mb-2 bg-white border border-gray-200 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`flex items-center gap-2 ${config.color}`}>
                              {config.icon({ className: "w-4 h-4" })}
                              <span className="font-medium text-gray-700">{config.label}</span>
                              <span className="text-xs text-gray-400">{formatTime(log.logged_at)}</span>
                            </div>
                            {(log.note || (log as HealthLogItem).notes) && (
                              <p className="text-sm text-gray-600 mt-1">{(log as HealthLogItem).notes || log.note}</p>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={(e) => handleEditLog(e, log)} className="p-1.5 text-gray-400 hover:text-[#2DD4BF] rounded-lg" title="수정"><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={(e) => handleDeleteLog(e, log)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg" title="삭제"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="mt-4 flex items-center justify-center gap-6">
        {Object.entries(categoryConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={config.color}>
              {config.icon({ className: "w-4 h-4" })}
            </div>
            <span className="text-sm text-gray-500">{config.label}</span>
          </div>
        ))}
      </div>

      {/* 월간 뷰: 해당 일 아이콘 클릭 시 수정/삭제 팝오버 */}
      {popoverTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/30"
          onClick={() => setPopoverTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {formatDate(popoverTarget.date)} · {categoryConfig[popoverTarget.category]?.label || popoverTarget.category}
              </h3>
              <button
                type="button"
                onClick={() => setPopoverTarget(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-3 max-h-[50vh] overflow-y-auto space-y-2">
              {getLogsForDate(popoverTarget.date)
                .filter((l) => l.category === popoverTarget.category)
                .map((log) => {
                  const config = categoryConfig[log.category as CategoryType]
                  if (!config) return null
                  const isCycle = log.category === 'cycle'
                  const canEdit = !isCycle
                  const description = isCycle
                    ? '그날 시작'
                    : (log as HealthLogItem).notes || log.note || '내용 없음'
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100"
                    >
                      <span className={config.color}>{config.icon({ className: "w-4 h-4" })}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-500">{formatTime(log.logged_at)}</span>
                        <p className="text-sm text-gray-800 truncate">{description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingLog(log as HealthLogItem)
                              setEditModalCategory(log.category as CategoryType)
                              setPopoverTarget(null)
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#2DD4BF] hover:bg-[#2DD4BF]/10 rounded-lg"
                            title="수정"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteLog(e, log)
                            setPopoverTarget(null)
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* 기록 추가 모달 */}
      {showAddModal && selectedDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">기록 추가</h3>
                <p className="text-sm text-gray-400">
                  {formatDate(selectedDate)} · 항목을 누르면 세부 입력 화면이 열립니다
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {Object.entries(categoryConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleOpenDetailModal(key as CategoryType)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-[#2DD4BF]/10`}>
                    <span className={config.color}>
                      {config.icon({ className: "w-5 h-5" })}
                    </span>
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-medium text-gray-900">{config.label} 기록</p>
                    <p className="text-sm text-gray-400">세부 내용을 입력해서 기록하기</p>
                  </div>
                  <Plus className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 그날(cycle) 기록 모달 - 캘린더에서 선택한 날짜로 그날 시작 */}
      {addDetailCategory === 'cycle' && selectedDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-1">그날 케어</h3>
            <p className="text-sm text-gray-500 mb-4">
              {formatDate(selectedDate)}에 그날 시작을 기록할까요?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddDetailCategory(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCycleStartFromCalendar}
                disabled={cycleAddSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B9D] text-white hover:bg-[#FF6B9D]/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cycleAddSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                그날 시작 기록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 식사/운동/복약 상세 입력 모달 (캘린더 기록 추가 시) 또는 수정 모달 */}
      <MealLogModal
        isOpen={(!!editingLog && editModalCategory === 'meal') || (addDetailCategory === 'meal' && !!selectedDate)}
        onClose={() => { setEditingLog(null); setEditModalCategory(null); setAddDetailCategory(null) }}
        onSuccess={() => { fetchLogs(); setEditingLog(null); setEditModalCategory(null); setAddDetailCategory(null); window.dispatchEvent(new Event('health-log-updated')) }}
        initialData={editModalCategory === 'meal' ? editingLog ?? undefined : undefined}
        defaultLoggedAt={addDetailCategory === 'meal' && selectedDate ? selectedDate.toISOString() : undefined}
      />
      <ExerciseLogModal
        isOpen={(!!editingLog && editModalCategory === 'exercise') || (addDetailCategory === 'exercise' && !!selectedDate)}
        onClose={() => { setEditingLog(null); setEditModalCategory(null); setAddDetailCategory(null) }}
        onSuccess={() => { fetchLogs(); setEditingLog(null); setEditModalCategory(null); setAddDetailCategory(null); window.dispatchEvent(new Event('health-log-updated')) }}
        initialData={editModalCategory === 'exercise' ? editingLog ?? undefined : undefined}
        defaultLoggedAt={addDetailCategory === 'exercise' && selectedDate ? selectedDate.toISOString() : undefined}
      />
      <MedicationLogModal
        isOpen={(!!editingLog && editModalCategory === 'medication') || (addDetailCategory === 'medication' && !!selectedDate)}
        onClose={() => { setEditingLog(null); setEditModalCategory(null); setAddDetailCategory(null) }}
        onSuccess={() => { fetchLogs(); setEditingLog(null); setEditModalCategory(null); setAddDetailCategory(null); window.dispatchEvent(new Event('health-log-updated')) }}
        initialData={editModalCategory === 'medication' ? editingLog ?? undefined : undefined}
        defaultLoggedAt={addDetailCategory === 'medication' && selectedDate ? selectedDate.toISOString() : undefined}
      />
    </div>
  )
}
