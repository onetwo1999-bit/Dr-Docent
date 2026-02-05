'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Camera, Upload, Loader2, Calendar, Clock } from 'lucide-react'
import { useToast } from './Toast'
import type { HealthLogItem } from './HealthLogButtons'

interface MealLogModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: HealthLogItem | null
  /** 캘린더에서 날짜 선택 후 열 때, 해당 날짜/시간으로 초기화 (ISO 문자열) */
  defaultLoggedAt?: string | null
}

export default function MealLogModal({ isOpen, onClose, onSuccess, initialData, defaultLoggedAt }: MealLogModalProps) {
  const { showToast, ToastComponent } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedTime, setSelectedTime] = useState(new Date().toTimeString().slice(0, 5))
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && initialData?.id) {
      const d = new Date(initialData.logged_at)
      setDescription(initialData.meal_description || initialData.notes || initialData.note || '')
      setImageUrl(initialData.image_url || null)
      setImagePreview(initialData.image_url || null)
      setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      setSelectedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    } else if (isOpen && !initialData) {
      setDescription('')
      setImageUrl(null)
      setImagePreview(null)
      setImageFile(null)
      if (defaultLoggedAt) {
        const d = new Date(defaultLoggedAt)
        setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
        setSelectedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
      } else {
        setSelectedDate(new Date().toISOString().split('T')[0])
        setSelectedTime(new Date().toTimeString().slice(0, 5))
      }
    }
  }, [isOpen, initialData, defaultLoggedAt])

  if (!isOpen) return null

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('이미지 크기는 5MB 이하여야 합니다.', 'error')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)

    setIsUploading(true)
    setImageUrl(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'meal')
      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.hint || '이미지 업로드 실패')
      }
      if (data.url) {
        setImageUrl(data.url)
        showToast('사진이 업로드되었습니다.', 'success')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '이미지 업로드 중 오류가 발생했습니다.'
      showToast(message, 'error')
      setImagePreview(null)
      setImageFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!description.trim() && !imageUrl && !imageFile) {
      showToast('식사 내용이나 사진 중 하나는 입력해주세요.', 'warning')
      return
    }
    if (imageFile && !imageUrl && !isUploading) {
      showToast('사진 업로드가 완료될 때까지 기다려주세요.', 'warning')
      return
    }

    setIsSubmitting(true)

    try {
      const loggedAt = new Date(`${selectedDate}T${selectedTime}`).toISOString()
      const isEdit = !!initialData?.id
      const body = {
        ...(isEdit && { id: initialData.id }),
        category: 'meal',
        meal_description: description.trim() || null,
        image_url: imageUrl || null,
        notes: description.trim() || null,
        logged_at: loggedAt
      }

      const response = await fetch('/api/health-logs', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      const result = await response.json()

      if (result.success) {
        showToast(isEdit ? '식사 기록이 수정되었습니다!' : '식사 기록이 저장되었습니다!', 'success')
        if (!isEdit) {
          setDescription('')
          setImageFile(null)
          setImagePreview(null)
          setImageUrl(null)
          setSelectedDate(new Date().toISOString().split('T')[0])
          setSelectedTime(new Date().toTimeString().slice(0, 5))
        }
        onSuccess()
        setTimeout(() => onClose(), 500)
      } else {
        showToast(result.error || (isEdit ? '식사 기록 수정에 실패했습니다.' : '식사 기록 저장에 실패했습니다.'), 'error')
      }
    } catch (error: any) {
      console.error('식사 기록 저장 실패:', error)
      showToast(error.message || '식사 기록 저장 중 오류가 발생했습니다.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {ToastComponent}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md border border-gray-100 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="bg-[#2DD4BF] p-4 text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">🥗 식사 기록</h2>
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
                  max={(() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })()}
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

            {/* 이미지 업로드 (선택 시 즉시 업로드) */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">식단 사진</label>
              {imagePreview ? (
                <div className="relative">
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center z-10">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                      <span className="ml-2 text-white text-sm">업로드 중...</span>
                    </div>
                  )}
                  <img
                    src={imagePreview}
                    alt="식단 미리보기"
                    className="w-full h-48 object-cover rounded-xl border border-gray-200"
                  />
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {!isUploading && imageUrl && (
                    <span className="absolute bottom-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded">
                      업로드 완료
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#2DD4BF] hover:text-[#2DD4BF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-sm">사진 추가하기</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* 식사 설명 */}
            <div>
              <label className="block text-sm text-gray-500 mb-2">식사 내용</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="어떤 음식을 드셨나요? 사진과 함께 상세히 적어주시면 AI가 영양 성분을 분석해 드립니다."
                rows={4}
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
              disabled={isSubmitting || isUploading || (!description.trim() && !imageUrl && !imageFile)}
              className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  저장 중...
                </>
              ) : isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  업로드 중...
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
