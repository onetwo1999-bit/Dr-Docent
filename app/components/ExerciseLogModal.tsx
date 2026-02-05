'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Calendar, Clock, Heart, Activity } from 'lucide-react'
import { useToast } from './Toast'
import type { HealthLogItem } from './HealthLogButtons'

interface ExerciseLogModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: HealthLogItem | null
  /** 캘린더에서 날짜 선택 후 열 때, "YYYY-MM-DD" 문자열만 전달 (파싱 없이 사용해 밀림 방지) */
  defaultLoggedAt?: string | null
}

function getTodayLocalString(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
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

export default function ExerciseLogModal({ isOpen, onClose, onSuccess, initialData, defaultLoggedAt }: ExerciseLogModalProps) {
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [exerciseType, setExerciseType] = useState('')
  const [duration, setDuration] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    if (isOpen && initialData?.id) {
      const d = new Date(initialData.logged_at)
      const im = initialData.intensity_metrics
      setExerciseType(initialData.exercise_type || (im && typeof im === 'object' && 'exercise_type' in im ? String((im as any).exercise_type) : '') || '')
      setDuration(initialData.duration_minutes != null ? String(initialData.duration_minutes) : (im && typeof im === 'object' && 'duration_minutes' in im ? String((im as any).duration_minutes) : '') || '')
      setHeartRate(initialData.heart_rate != null ? String(initialData.heart_rate) : (im && typeof im === 'object' && ('heart_rate' in im || 'average_heart_rate' in im) ? String((im as any).heart_rate ?? (im as any).average_heart_rate) : '') || '')
      setWeight(initialData.weight_kg != null ? String(initialData.weight_kg) : '')
      setReps(initialData.reps != null ? String(initialData.reps) : '')
      setSets(initialData.sets != null ? String(initialData.sets) : '')
      setNotes(initialData.notes || initialData.note || '')
      setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      setSelectedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    } else if (isOpen && !initialData) {
      setExerciseType('')
      setDuration('')
      setHeartRate('')
      setWeight('')
      setReps('')
      setSets('')
      setNotes('')
      if (defaultLoggedAt && /^\d{4}-\d{2}-\d{2}$/.test(defaultLoggedAt)) {
        setSelectedDate(defaultLoggedAt)
        setSelectedTime('09:00')
      } else {
        setSelectedDate(getTodayLocalString())
        setSelectedTime(new Date().toTimeString().slice(0, 5))
      }
    }
  }, [isOpen, initialData, defaultLoggedAt])

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

    const todayStr = getTodayLocalString()
    if (selectedDate > todayStr) {
      showToast('오늘 이후 날짜에는 기록할 수 없습니다.', 'warning')
      return
    }

    setIsSubmitting(true)

    try {
      const loggedAt = new Date(`${selectedDate}T${selectedTime}`).toISOString()
      const durationMinutes = parseInt(duration)
      const heartRateValue = heartRate ? parseInt(heartRate) : null

      // 무게, 횟수, 세트 정보를 notes에 예쁘게 포맷팅
      const exerciseDetails: string[] = []
      
      if (weight && weight.trim()) {
        exerciseDetails.push(`무게: ${weight.trim()}kg`)
      }
      if (reps && reps.trim()) {
        exerciseDetails.push(`횟수: ${reps.trim()}회`)
      }
      if (sets && sets.trim()) {
        exerciseDetails.push(`세트: ${sets.trim()}세트`)
      }
      
      // 기존 메모와 운동 상세 정보를 합침
      let finalNotes = notes.trim()
      if (exerciseDetails.length > 0) {
        const detailsText = exerciseDetails.join(' | ')
        finalNotes = finalNotes 
          ? `${detailsText}\n${finalNotes}`
          : detailsText
      }

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
      
      // 무게, 횟수, 세트 정보를 intensity_metrics에도 포함
      let weightKg: number | null = null
      let repsValue: number | null = null
      let setsValue: number | null = null
      
      if (weight && weight.trim()) {
        const parsedWeight = Number(weight.trim())
        if (!isNaN(parsedWeight) && parsedWeight > 0) {
          weightKg = parsedWeight
          intensityMetrics.weight_kg = weightKg
        }
      }
      if (reps && reps.trim()) {
        const parsedReps = Number(reps.trim())
        if (!isNaN(parsedReps) && parsedReps > 0) {
          repsValue = parsedReps
          intensityMetrics.reps = repsValue
        }
      }
      if (sets && sets.trim()) {
        const parsedSets = Number(sets.trim())
        if (!isNaN(parsedSets) && parsedSets > 0) {
          setsValue = parsedSets
          intensityMetrics.sets = setsValue
        }
      }

      // body 객체 생성 - weight_kg, reps, sets 명시적으로 포함
      const requestBody: any = {
        category: 'exercise',
        exercise_type: exerciseType,
        duration_minutes: durationMinutes,
        heart_rate: heartRateValue,
        intensity_metrics: intensityMetrics,
        notes: finalNotes || null,
        logged_at: loggedAt,
        // 무게, 횟수, 세트를 body에 직접 포함 (null이어도 명시적으로 포함)
        weight_kg: weightKg !== null ? Number(weightKg) : null,
        reps: repsValue !== null ? Number(repsValue) : null,
        sets: setsValue !== null ? Number(setsValue) : null
      }

      console.log('🏋️ [ExerciseLogModal] 전송 데이터:', {
        weight_kg: requestBody.weight_kg,
        reps: requestBody.reps,
        sets: requestBody.sets,
        has_intensity_metrics: !!requestBody.intensity_metrics
      })

      const isEdit = !!initialData?.id
      if (isEdit) {
        (requestBody as any).id = initialData.id
      }

      const response = await fetch('/api/health-logs', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        showToast(isEdit ? '운동 기록이 수정되었습니다!' : '오늘의 오운완 기록 성공!', 'success')
        if (!isEdit) {
          setExerciseType('')
          setDuration('')
          setHeartRate('')
          setWeight('')
          setReps('')
          setSets('')
          setNotes('')
          setSelectedDate(new Date().toISOString().split('T')[0])
          setSelectedTime(new Date().toTimeString().slice(0, 5))
        }
        onSuccess()
        setTimeout(() => onClose(), 500)
      } else {
        showToast(result.error || (isEdit ? '운동 기록 수정에 실패했습니다.' : '운동 기록 저장에 실패했습니다.'), 'error')
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
                  max={getTodayLocalString()}
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

            {/* 무게, 횟수, 세트 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-500 mb-2">무게 (kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="예: 50"
                  min="0"
                  step="0.5"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">횟수 (회)</label>
                <input
                  type="number"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="예: 10"
                  min="1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-2">세트</label>
                <input
                  type="number"
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                  placeholder="예: 3"
                  min="1"
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
