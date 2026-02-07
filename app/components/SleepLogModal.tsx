'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Calendar, Clock, Moon } from 'lucide-react'
import { useToast } from './Toast'
import type { HealthLogItem } from './HealthLogButtons'

interface SleepLogModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (payload?: { sleep_duration_hours?: number }) => void
  initialData?: HealthLogItem | null
  defaultLoggedAt?: string | null
}

function getTodayLocalString(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const HOURS_MIN = 0
const HOURS_MAX = 24
const HOURS_STEP = 0.5

export default function SleepLogModal({ isOpen, onClose, onSuccess, initialData, defaultLoggedAt }: SleepLogModalProps) {
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hours, setHours] = useState(7)
  const [notes, setNotes] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    if (isOpen && initialData?.id) {
      const d = new Date(initialData.logged_at)
      const h = initialData.sleep_duration_hours != null ? Number(initialData.sleep_duration_hours) : 7
      setHours(h >= HOURS_MIN && h <= HOURS_MAX ? h : 7)
      setNotes(initialData.notes || initialData.note || '')
      setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      setSelectedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    } else if (isOpen && !initialData) {
      setHours(7)
      setNotes('')
      if (defaultLoggedAt && /^\d{4}-\d{2}-\d{2}$/.test(defaultLoggedAt)) {
        setSelectedDate(defaultLoggedAt)
        setSelectedTime('07:00')
      } else {
        setSelectedDate(getTodayLocalString())
        setSelectedTime(new Date().toTimeString().slice(0, 5))
      }
    }
  }, [isOpen, initialData, defaultLoggedAt])

  if (!isOpen) return null

  const handleSubmit = async () => {
    const todayStr = getTodayLocalString()
    if (selectedDate > todayStr) {
      showToast('오늘 이후 날짜에는 기록할 수 없습니다.', 'warning')
      return
    }

    const value = Number(hours)
    if (isNaN(value) || value < HOURS_MIN || value > HOURS_MAX) {
      showToast('수면 시간은 0~24시간 사이로 입력해주세요.', 'warning')
      return
    }

    setIsSubmitting(true)

    try {
      const loggedAt = new Date(`${selectedDate}T${selectedTime}`).toISOString()
      const isEdit = !!initialData?.id
      const body: Record<string, unknown> = {
        category: 'sleep',
        sleep_duration_hours: value,
        notes: notes.trim() || null,
        logged_at: loggedAt,
      }
      if (isEdit) body.id = initialData.id

      const response = await fetch('/api/health-logs', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        showToast(isEdit ? '수면 기록이 수정되었습니다!' : '수면 기록이 저장되었습니다!', 'success')
        if (!isEdit) {
          setHours(7)
          setNotes('')
        }
        onSuccess({ sleep_duration_hours: value })
        onClose()
      } else {
        showToast(result.error || '저장에 실패했습니다.', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Moon className="w-5 h-5 text-[#2DD4BF]" />
            수면 시간 입력
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4" onClick={e => e.stopPropagation()}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">기록 시각</label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <input
                type="time"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">몇 시간 잤나요?</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={HOURS_MIN}
                max={HOURS_MAX}
                step={HOURS_STEP}
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="flex-1 h-3 rounded-full appearance-none bg-gray-200 accent-[#2DD4BF]"
              />
              <input
                type="number"
                min={HOURS_MIN}
                max={HOURS_MAX}
                step={HOURS_STEP}
                value={hours}
                onChange={e => setHours(Number(e.target.value) || 0)}
                className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-center text-base font-semibold"
              />
              <span className="text-gray-500 text-sm">시간</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">0 ~ 24시간 (숫자 입력 또는 슬라이더)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="예: 숙면, 낮잠 등"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-xl bg-[#2DD4BF] text-white font-medium hover:bg-[#26b8a5] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
      {ToastComponent}
    </>
  )
}
