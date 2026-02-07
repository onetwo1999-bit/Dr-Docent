'use client'

import { useState, useEffect } from 'react'
import { Utensils, Dumbbell, Pill, Moon, Check, Loader2, Pencil, Trash2 } from 'lucide-react'
import MealLogModal from './MealLogModal'
import ExerciseLogModal from './ExerciseLogModal'
import MedicationLogModal from './MedicationLogModal'
import SleepLogModal from './SleepLogModal'

type CategoryType = 'meal' | 'exercise' | 'medication' | 'sleep'

const categoryLabels: Record<CategoryType, string> = {
  meal: '식사',
  exercise: '운동',
  medication: '복약',
  sleep: '수면'
}

export interface HealthLogItem {
  id: string
  category: string
  logged_at: string
  notes?: string | null
  note?: string | null
  meal_description?: string | null
  image_url?: string | null
  exercise_type?: string | null
  duration_minutes?: number | null
  heart_rate?: number | null
  weight_kg?: number | null
  reps?: number | null
  sets?: number | null
  intensity_metrics?: Record<string, unknown> | null
  medication_name?: string | null
  medication_dosage?: string | null
  medication_ingredients?: string | null
  sleep_duration_hours?: number | null
}

interface TodayStats {
  meal: number
  exercise: number
  medication: number
  sleep: number
}

interface LogButtonProps {
  category: CategoryType
  icon: React.ReactNode
  label: string
  count: number
  onLog: () => void
  isLoading: boolean
  isSuccess: boolean
}

function LogButton({ category, icon, label, count, onLog, isLoading, isSuccess }: LogButtonProps) {
  return (
    <button
      onClick={onLog}
      disabled={isLoading}
      className={`
        flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border transition-all duration-200
        ${isSuccess 
          ? 'bg-[#2DD4BF]/5 border-[#2DD4BF] scale-[1.02]' 
          : 'bg-white border-gray-200 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5'
        }
        ${isLoading ? 'opacity-60 cursor-wait' : 'cursor-pointer active:scale-[0.98]'}
      `}
    >
      <div className={`
        w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-2 transition-all
        ${isSuccess ? 'bg-[#2DD4BF] shadow-sm' : 'bg-[#2DD4BF]/10'}
      `}>
        {isLoading ? (
          <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-[#2DD4BF] animate-spin" />
        ) : isSuccess ? (
          <Check className="w-5 h-5 md:w-6 md:h-6 text-white" />
        ) : (
          <span className="text-[#2DD4BF]">{icon}</span>
        )}
      </div>
      <span className="text-xs md:text-sm font-semibold text-gray-800 mb-0.5">{label}</span>
      <span className="text-xs text-gray-500">
        {count > 0 ? `오늘 ${count}회` : '기록하기'}
      </span>
    </button>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function logSummary(log: HealthLogItem): string {
  if (log.category === 'meal') return log.meal_description || log.notes || log.note || '식사'
  if (log.category === 'exercise') {
    const parts = []
    if (log.exercise_type) parts.push(log.exercise_type)
    if (log.duration_minutes) parts.push(`${log.duration_minutes}분`)
    if (log.weight_kg) parts.push(`${log.weight_kg}kg`)
    if (log.reps) parts.push(`${log.reps}회`)
    if (log.sets) parts.push(`${log.sets}세트`)
    return parts.length ? parts.join(' · ') : (log.notes || log.note || '운동')
  }
  if (log.category === 'medication') return log.medication_name || log.notes || log.note || '복약'
  if (log.category === 'sleep') return log.sleep_duration_hours != null ? `${log.sleep_duration_hours}시간 수면` : (log.notes || log.note || '수면')
  return log.notes || log.note || '기록'
}

export default function HealthLogButtons() {
  const [todayStats, setTodayStats] = useState<TodayStats>({
    meal: 0,
    exercise: 0,
    medication: 0,
    sleep: 0
  })
  const [todayLogs, setTodayLogs] = useState<HealthLogItem[]>([])
  const [loadingCategory, setLoadingCategory] = useState<CategoryType | null>(null)
  const [successCategory, setSuccessCategory] = useState<CategoryType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openModal, setOpenModal] = useState<CategoryType | null>(null)
  /** 수정 시 열 모달: 해당 카테고리 + 기존 로그 데이터 */
  const [editingLog, setEditingLog] = useState<HealthLogItem | null>(null)
  /** 성공 토스트에 수정/저장 구분 표시용 */
  const [lastSuccessAction, setLastSuccessAction] = useState<'add' | 'edit'>('add')

  // 오늘 통계 + 오늘 기록 목록 불러오기
  useEffect(() => {
    fetchTodayStats()
  }, [])

  const fetchTodayStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/health-logs?start_date=${today}&end_date=${today}`)
      const data = await response.json()
      
      if (data.success) {
        if (data.todayStats) setTodayStats(data.todayStats)
        if (Array.isArray(data.data)) setTodayLogs(data.data)
      }
    } catch (err) {
      console.error('통계 조회 실패:', err)
    }
  }

  const handleLog = (category: CategoryType, initialData?: HealthLogItem | null) => {
    setEditingLog(initialData ?? null)
    setOpenModal(category)
  }

  const handleModalSuccess = (category: CategoryType) => {
    setError(null)
    setLastSuccessAction(editingLog ? 'edit' : 'add')
    setSuccessCategory(category)
    setTodayStats(prev => ({
      ...prev,
      [category]: prev[category] + (editingLog ? 0 : 1)
    }))
    setEditingLog(null)
    window.dispatchEvent(new CustomEvent('health-log-updated', { detail: { category } }))
    window.dispatchEvent(new CustomEvent('ranking-updated'))
    setTimeout(() => setSuccessCategory(null), 3000)
    fetchTodayStats()
  }

  const handleDelete = async (log: HealthLogItem) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/health-logs?id=${encodeURIComponent(log.id)}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setError(null)
        window.dispatchEvent(new CustomEvent('health-log-updated', { detail: { category: log.category } }))
        window.dispatchEvent(new CustomEvent('ranking-updated'))
        fetchTodayStats()
      } else {
        setError(data.error || '삭제에 실패했습니다.')
      }
    } catch (err) {
      console.error('삭제 실패:', err)
      setError('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleCloseModal = () => {
    setOpenModal(null)
    setEditingLog(null)
  }

  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">오늘의 건강 기록</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
          ⚠️ {error}
        </div>
      )}

      {/* 4개의 로그 버튼 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <LogButton
          category="meal"
          icon={<Utensils className="w-5 h-5 md:w-6 md:h-6" />}
          label="식사 기록"
          count={todayStats.meal}
          onLog={() => handleLog('meal')}
          isLoading={loadingCategory === 'meal'}
          isSuccess={successCategory === 'meal'}
        />
        <LogButton
          category="exercise"
          icon={<Dumbbell className="w-5 h-5 md:w-6 md:h-6" />}
          label="운동 완료"
          count={todayStats.exercise}
          onLog={() => handleLog('exercise')}
          isLoading={loadingCategory === 'exercise'}
          isSuccess={successCategory === 'exercise'}
        />
        <LogButton
          category="medication"
          icon={<Pill className="w-5 h-5 md:w-6 md:h-6" />}
          label="복약 완료"
          count={todayStats.medication}
          onLog={() => handleLog('medication')}
          isLoading={loadingCategory === 'medication'}
          isSuccess={successCategory === 'medication'}
        />
        <LogButton
          category="sleep"
          icon={<Moon className="w-5 h-5 md:w-6 md:h-6" />}
          label="수면 기록"
          count={todayStats.sleep}
          onLog={() => handleLog('sleep')}
          isLoading={loadingCategory === 'sleep'}
          isSuccess={successCategory === 'sleep'}
        />
      </div>

      {/* 성공 토스트 메시지 (저장/수정 구분) */}
      {successCategory && (
        <div className="mt-4 p-3 bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] text-sm rounded-lg text-center font-medium">
          ✓ {categoryLabels[successCategory]} 기록이 {lastSuccessAction === 'edit' ? '수정' : '저장'}되었습니다!
        </div>
      )}

      {/* 오늘의 기록 리스트 (수정/삭제) */}
      {todayLogs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">오늘의 기록</h4>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {todayLogs.map((log) => {
              const cat = log.category as CategoryType
              const config = {
                meal: { icon: <Utensils className="w-4 h-4" />, label: categoryLabels.meal },
                exercise: { icon: <Dumbbell className="w-4 h-4" />, label: categoryLabels.exercise },
                medication: { icon: <Pill className="w-4 h-4" />, label: categoryLabels.medication },
                sleep: { icon: <Moon className="w-4 h-4" />, label: categoryLabels.sleep }
              }[cat]
              if (!config) return null
              return (
                <li
                  key={log.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/80"
                >
                  <span className="text-[#2DD4BF]">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-500">{formatTime(log.logged_at)}</span>
                    <p className="text-sm text-gray-800 truncate">{logSummary(log)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleLog(cat, log) }}
                    className="p-1.5 text-gray-400 hover:text-[#2DD4BF] hover:bg-[#2DD4BF]/10 rounded-lg transition-colors"
                    title="수정"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(log) }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 안내 문구 */}
      <p className="mt-4 text-xs text-gray-400 text-center">
        버튼을 눌러 상세 정보를 입력하세요
      </p>

      {/* 모달들 */}
      <MealLogModal
        isOpen={openModal === 'meal'}
        onClose={handleCloseModal}
        onSuccess={() => handleModalSuccess('meal')}
        initialData={openModal === 'meal' ? editingLog : null}
      />
      <ExerciseLogModal
        isOpen={openModal === 'exercise'}
        onClose={handleCloseModal}
        onSuccess={() => handleModalSuccess('exercise')}
        initialData={openModal === 'exercise' ? editingLog : null}
      />
      <MedicationLogModal
        isOpen={openModal === 'medication'}
        onClose={handleCloseModal}
        onSuccess={() => handleModalSuccess('medication')}
        initialData={openModal === 'medication' ? editingLog : null}
      />
      <SleepLogModal
        isOpen={openModal === 'sleep'}
        onClose={handleCloseModal}
        onSuccess={() => handleModalSuccess('sleep')}
        initialData={openModal === 'sleep' ? editingLog : null}
      />
    </div>
  )
}
