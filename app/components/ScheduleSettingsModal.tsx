'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  Utensils, 
  Dumbbell, 
  Pill, 
  Heart,
  Clock,
  Calendar,
  Bell,
  Plus,
  Trash2,
  Loader2,
  Check
} from 'lucide-react'

type CategoryType = 'meal' | 'exercise' | 'medication' | 'cycle'
type FrequencyType = 'daily' | 'weekly' | 'monthly'

interface Schedule {
  id?: string
  category: CategoryType
  sub_type?: string
  title: string
  description?: string
  frequency: FrequencyType
  scheduled_time: string
  days_of_week: number[]
  day_of_month?: number
  is_active: boolean
  notification_enabled: boolean
}

interface ScheduleSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  category: CategoryType
}

const categoryConfig = {
  meal: { 
    icon: <Utensils className="w-5 h-5" />, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-100',
    label: '식사',
    subTypes: [
      { value: 'breakfast', label: '아침 식사', defaultTime: '08:00' },
      { value: 'lunch', label: '점심 식사', defaultTime: '12:00' },
      { value: 'dinner', label: '저녁 식사', defaultTime: '18:00' },
      { value: 'snack', label: '간식', defaultTime: '15:00' },
    ]
  },
  exercise: { 
    icon: <Dumbbell className="w-5 h-5" />, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-100',
    label: '운동',
    subTypes: [
      { value: 'cardio', label: '유산소 운동', defaultTime: '07:00' },
      { value: 'strength', label: '근력 운동', defaultTime: '18:00' },
      { value: 'yoga', label: '요가/스트레칭', defaultTime: '07:00' },
      { value: 'walk', label: '산책', defaultTime: '19:00' },
    ]
  },
  medication: { 
    icon: <Pill className="w-5 h-5" />, 
    color: 'text-purple-500', 
    bgColor: 'bg-purple-100',
    label: '복약',
    subTypes: [
      { value: 'morning', label: '아침 복약', defaultTime: '08:00' },
      { value: 'afternoon', label: '점심 복약', defaultTime: '12:30' },
      { value: 'evening', label: '저녁 복약', defaultTime: '19:00' },
      { value: 'bedtime', label: '취침 전 복약', defaultTime: '22:00' },
    ]
  },
  cycle: { 
    icon: <Heart className="w-5 h-5" />, 
    color: 'text-pink-500', 
    bgColor: 'bg-pink-100',
    label: '그날 케어',
    subTypes: [
      { value: 'reminder', label: '예정일 알림', defaultTime: '09:00' },
    ]
  },
}

const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']

export default function ScheduleSettingsModal({ isOpen, onClose, category }: ScheduleSettingsModalProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const config = categoryConfig[category]

  useEffect(() => {
    if (isOpen) {
      fetchSchedules()
    }
  }, [isOpen, category])

  const fetchSchedules = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/schedules?category=${category}`)
      const data = await response.json()
      if (data.success) {
        setSchedules(data.data || [])
      } else {
        // 스케줄이 없으면 기본값 설정
        const defaultSchedules = config.subTypes.map(subType => ({
          category,
          sub_type: subType.value,
          title: subType.label,
          frequency: 'daily' as FrequencyType,
          scheduled_time: subType.defaultTime,
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          is_active: true,
          notification_enabled: true
        }))
        setSchedules(defaultSchedules)
      }
    } catch (error) {
      console.error('스케줄 조회 실패:', error)
      // 에러 시에도 기본값 설정
      const defaultSchedules = config.subTypes.map(subType => ({
        category,
        sub_type: subType.value,
        title: subType.label,
        frequency: 'daily' as FrequencyType,
        scheduled_time: subType.defaultTime,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        is_active: true,
        notification_enabled: true
      }))
      setSchedules(defaultSchedules)
    } finally {
      setIsLoading(false)
    }
  }

  const updateSchedule = (index: number, updates: Partial<Schedule>) => {
    setSchedules(prev => prev.map((s, i) => 
      i === index ? { ...s, ...updates } : s
    ))
  }

  const toggleDay = (scheduleIndex: number, dayIndex: number) => {
    const schedule = schedules[scheduleIndex]
    const days = schedule.days_of_week.includes(dayIndex)
      ? schedule.days_of_week.filter(d => d !== dayIndex)
      : [...schedule.days_of_week, dayIndex].sort()
    updateSchedule(scheduleIndex, { days_of_week: days })
  }

  const addSchedule = () => {
    const newSchedule: Schedule = {
      category,
      sub_type: 'custom',
      title: '새 알림',
      frequency: 'daily',
      scheduled_time: '09:00',
      days_of_week: [1, 2, 3, 4, 5],
      is_active: true,
      notification_enabled: true
    }
    setSchedules(prev => [...prev, newSchedule])
  }

  const removeSchedule = (index: number) => {
    setSchedules(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      })

      const data = await response.json()
      if (data.success) {
        setMessage('설정이 저장되었습니다!')
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        setMessage(data.error || '저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('저장 실패:', error)
      setMessage('네트워크 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-xl">
        {/* 헤더 */}
        <div className={`${config.bgColor} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center ${config.color}`}>
                {config.icon}
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{config.label} 알림 설정</h2>
                <p className="text-sm text-gray-600">상세 시간을 설정하세요</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${
                    schedule.is_active 
                      ? 'border-gray-200 bg-white' 
                      : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  {/* 제목 및 활성화 토글 */}
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={schedule.title}
                      onChange={(e) => updateSchedule(index, { title: e.target.value })}
                      className="font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateSchedule(index, { is_active: !schedule.is_active })}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          schedule.is_active ? 'bg-[#2DD4BF]' : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          schedule.is_active ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                      {schedules.length > 1 && (
                        <button
                          onClick={() => removeSchedule(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 시간 설정 */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={schedule.scheduled_time}
                        onChange={(e) => updateSchedule(index, { scheduled_time: e.target.value })}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-gray-400" />
                      <button
                        onClick={() => updateSchedule(index, { notification_enabled: !schedule.notification_enabled })}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          schedule.notification_enabled
                            ? 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {schedule.notification_enabled ? '알림 켜짐' : '알림 꺼짐'}
                      </button>
                    </div>
                  </div>

                  {/* 반복 주기 */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <select
                        value={schedule.frequency}
                        onChange={(e) => updateSchedule(index, { frequency: e.target.value as FrequencyType })}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                      >
                        <option value="daily">매일</option>
                        <option value="weekly">매주</option>
                        <option value="monthly">매월</option>
                      </select>
                    </div>

                    {/* 요일 선택 (주간 반복) */}
                    {schedule.frequency === 'weekly' && (
                      <div className="flex gap-1 mt-2">
                        {daysOfWeek.map((day, dayIndex) => (
                          <button
                            key={dayIndex}
                            onClick={() => toggleDay(index, dayIndex)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                              schedule.days_of_week.includes(dayIndex)
                                ? 'bg-[#2DD4BF] text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* 일 선택 (월간 반복) */}
                    {schedule.frequency === 'monthly' && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-500">매월</span>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={schedule.day_of_month || 1}
                          onChange={(e) => updateSchedule(index, { day_of_month: parseInt(e.target.value) })}
                          className="w-16 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                        />
                        <span className="text-sm text-gray-500">일</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* 알림 추가 버튼 */}
              <button
                onClick={addSchedule}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-[#2DD4BF] hover:text-[#2DD4BF] transition-colors"
              >
                <Plus className="w-5 h-5" />
                알림 추가
              </button>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t border-gray-100">
          {message && (
            <div className={`mb-3 p-3 rounded-xl text-sm text-center ${
              message.includes('실패') || message.includes('오류')
                ? 'bg-red-50 text-red-600'
                : 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
            }`}>
              {message}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-[#2DD4BF] text-white font-medium hover:bg-[#26b8a5] transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
