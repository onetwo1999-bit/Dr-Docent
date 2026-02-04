'use client'

import { useState } from 'react'
import { X, Loader2, Calendar, Clock, Heart, Activity } from 'lucide-react'
import { useToast } from './Toast'

interface ExerciseLogModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const exerciseTypes = [
  { value: 'cardio', label: '유산소' },
  { value: 'weight', label: '웨이트' },
  { value: 'walking', label: '걷기' },
  { value: 'running', label: '러닝' },
  { value: 'pilates', label: '필라테스' },
  { value: 'yoga', label: '요가' },
  { value: 'cycling', label: '사이클' },
  { value: 'swimming', label: '수영' },
  { value: 'other', label: '기타' }
]

export default function ExerciseLogModal({ isOpen, onClose, onSuccess }: ExerciseLogModalProps) {
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [exerciseType, setExerciseType] = useState('')
  const [duration, setDuration] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5))

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!exerciseType) {
      showToast('운동 종류를 선택해주세요.', 'warning')
      return
    }

    if (!duration || parseInt(duration) <= 0) {
      showToast('운동 시간을 입력해주세요.', 'warning')
      return
    }

    setIsSubmitting(true)

    try {
      const loggedAt = new Date(`${selectedDate}T${selectedTime}`).toISOString()
      const durationMinutes = parseInt(duration)
      const heartRateValue = heartRate ? parseInt(heartRate) : null

      // intensity_metrics: 운동 시간(분)·평균 심박수가 JSONB에 정확히 담기도록
      const intensityMetrics: Record<string, unknown> = {
        duration_minutes: durationMinutes,
        average_heart_rate: heartRateValue ?? null,
        exercise_type: exerciseType
      }
      if (heartRateValue != null) {
        intensityMetrics.heart_rate = heartRateValue
        if (heartRateValue >= 180) intensityMetrics.intensity_level = 'very_high'
        else if (heartRateValue >= 150) intensityMetrics.intensity_level = 'high'
        else if (heartRateValue >= 120) intensityMetrics.intensity_level = 'moderate'
        else intensityMetrics.intensity_level = 'low'
      }

      const response = await fetch('/api/health-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: 'exercise',
          exercise_type: exerciseType,
          duration_minutes: durationMinutes,
          heart_rate: heartRateValue,
          intensity_metrics: intensityMetrics,
          notes: notes.trim() || null,
          logged_at: loggedAt
        })
      })

      const result = await response.json()

      if (result.success) {
        showToast('오늘의 오운완 기록 성공!', 'success')
        // 폼 초기화
        setExerciseType('')
        setDuration('')
        setHeartRate('')
        setNotes('')
        setSelectedDate(new Date().toISOString().split('T')[0])
        setSelectedTime(new Date().toTimeString().slice(0, 5))
        onSuccess()
        setTimeout(() => onClose(), 500)
      } else {
        showToast(result.error || '운동 기록 저장에 실패했습니다.', 'error')
      }
    } catch (error: any) {
      console.error('운동 기록 저장 실패:', error)
      showToast(error.message || '운동 기록 저장 중 오류가 발생했습니다.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {ToastComponent}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md border border-gray-100 shadow-xl overflow-hidden">
          {/* 헤더 */}
          <div className="bg-[#2DD4BF] p-4 text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">🏋️ 운동 기록</h2>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* 본문 */}
          <div className="p-6 space-y-4">
            {/* 날짜 및 시간 선택 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  날짜
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  시간
                </label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
            </div>

            {/* 운동 종류 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2 flex items-center gap-1">
                <Activity className="w-4 h-4" />
                운동 종류
              </label>
              <select
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              >
                <option value="">선택해주세요</option>
                {exerciseTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 운동 시간 및 심박수 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-2">운동 시간 (분)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="예: 30"
                  min="1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2 flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  평균 심박수 (bpm)
                </label>
                <input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  placeholder="예: 150"
                  min="40"
                  max="220"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">메모 (선택)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="운동 종류와 평균 심박수, 시간을 입력하면 정확한 소모 칼로리와 체력 점수를 계산합니다."
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* 푸터 */}
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white hover:bg-gray-50 text-gray-600 py-3 rounded-xl font-semibold transition-colors border border-gray-200"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !exerciseType || !duration}
              className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장하기'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
