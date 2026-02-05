'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Calendar, Clock, Pill } from 'lucide-react'
import { useToast } from './Toast'
import type { HealthLogItem } from './HealthLogButtons'

interface MedicationLogModalProps {
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

export default function MedicationLogModal({ isOpen, onClose, onSuccess, initialData, defaultLoggedAt }: MedicationLogModalProps) {
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [medicationName, setMedicationName] = useState('')
  const [dosage, setDosage] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    if (isOpen && initialData?.id) {
      const d = new Date(initialData.logged_at)
      setMedicationName(initialData.medication_name || '')
      setDosage(initialData.medication_dosage || '')
      setIngredients(initialData.medication_ingredients || '')
      setNotes(initialData.notes || initialData.note || '')
      setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      setSelectedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    } else if (isOpen && !initialData) {
      setMedicationName('')
      setDosage('')
      setIngredients('')
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
    if (!medicationName.trim()) {
      showToast('약 이름을 입력해주세요.', 'warning')
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
      const isEdit = !!initialData?.id
      const body: Record<string, unknown> = {
        category: 'medication',
        medication_name: medicationName.trim(),
        medication_dosage: dosage.trim() || null,
        medication_ingredients: ingredients.trim() || null,
        notes: notes.trim() || null,
        logged_at: loggedAt
      }
      if (isEdit) body.id = initialData.id

      const response = await fetch('/api/health-logs', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const result = await response.json()

      if (result.success) {
        showToast(isEdit ? '복약 기록이 수정되었습니다!' : '복약 기록이 저장되었습니다!', 'success')
        if (!isEdit) {
          setMedicationName('')
          setDosage('')
          setIngredients('')
          setNotes('')
          setSelectedDate(new Date().toISOString().split('T')[0])
          setSelectedTime(new Date().toTimeString().slice(0, 5))
        }
        onSuccess()
        setTimeout(() => onClose(), 500)
      } else {
        showToast(result.error || (isEdit ? '복약 기록 수정에 실패했습니다.' : '복약 기록 저장에 실패했습니다.'), 'error')
      }
    } catch (error: any) {
      console.error('복약 기록 저장 실패:', error)
      showToast(error.message || '복약 기록 저장 중 오류가 발생했습니다.', 'error')
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
              <h2 className="font-bold text-lg">💊 복약 기록</h2>
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

            {/* 약 이름 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2 flex items-center gap-1">
                <Pill className="w-4 h-4" />
                약 이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                placeholder="예: 오메가3, 혈압약, 비타민D"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              />
            </div>

            {/* 용량 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">용량 (선택)</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="예: 1000mg, 1정, 500IU"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              />
            </div>

            {/* 주요 성분 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">주요 성분 (선택)</label>
              <input
                type="text"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="예: EPA, DHA, 칼슘, 마그네슘"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">메모 (선택)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="약 이름과 용량(예: 오메가3 1000mg)을 적어주세요. 기저질환과의 상충 여부를 체크하는 기초 데이터가 됩니다."
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
              disabled={isSubmitting || !medicationName.trim()}
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
