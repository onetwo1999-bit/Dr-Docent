'use client'

import { useState, useEffect } from 'react'
import { Utensils, Dumbbell, Pill, Check, Loader2 } from 'lucide-react'
import MealLogModal from './MealLogModal'
import ExerciseLogModal from './ExerciseLogModal'
import MedicationLogModal from './MedicationLogModal'

type CategoryType = 'meal' | 'exercise' | 'medication'

const categoryLabels: Record<CategoryType, string> = {
  meal: '식사',
  exercise: '운동',
  medication: '복약'
}

interface TodayStats {
  meal: number
  exercise: number
  medication: number
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
        flex flex-col items-center justify-center p-5 rounded-xl border transition-all duration-200
        ${isSuccess 
          ? 'bg-[#2DD4BF]/5 border-[#2DD4BF] scale-[1.02]' 
          : 'bg-white border-gray-200 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5'
        }
        ${isLoading ? 'opacity-60 cursor-wait' : 'cursor-pointer active:scale-[0.98]'}
      `}
    >
      <div className={`
        w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-all
        ${isSuccess ? 'bg-[#2DD4BF] shadow-sm' : 'bg-[#2DD4BF]/10'}
      `}>
        {isLoading ? (
          <Loader2 className="w-7 h-7 text-[#2DD4BF] animate-spin" />
        ) : isSuccess ? (
          <Check className="w-7 h-7 text-white" />
        ) : (
          <span className="text-[#2DD4BF]">{icon}</span>
        )}
      </div>
      <span className="text-sm font-semibold text-gray-800 mb-1">{label}</span>
      <span className="text-xs text-gray-500">
        {count > 0 ? `오늘 ${count}회` : '기록하기'}
      </span>
    </button>
  )
}

export default function HealthLogButtons() {
  const [todayStats, setTodayStats] = useState<TodayStats>({
    meal: 0,
    exercise: 0,
    medication: 0
  })
  const [loadingCategory, setLoadingCategory] = useState<CategoryType | null>(null)
  const [successCategory, setSuccessCategory] = useState<CategoryType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openModal, setOpenModal] = useState<CategoryType | null>(null)

  // 오늘 통계 불러오기
  useEffect(() => {
    fetchTodayStats()
  }, [])

  const fetchTodayStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/health-logs?start_date=${today}&end_date=${today}`)
      const data = await response.json()
      
      if (data.success && data.todayStats) {
        setTodayStats(data.todayStats)
      }
    } catch (err) {
      console.error('통계 조회 실패:', err)
    }
  }

  const handleLog = (category: CategoryType) => {
    // 모달 열기
    setOpenModal(category)
  }

  const handleModalSuccess = (category: CategoryType) => {
    // 성공 애니메이션
    setSuccessCategory(category)
    setTodayStats(prev => ({
      ...prev,
      [category]: prev[category] + 1
    }))

    // 캘린더 실시간 동기화를 위한 이벤트 발생
    window.dispatchEvent(new CustomEvent('health-log-updated', { 
      detail: { category } 
    }))

    // 3초 후 성공 상태 초기화
    setTimeout(() => {
      setSuccessCategory(null)
    }, 3000)

    // 통계 새로고침
    fetchTodayStats()
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-5">
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

      {/* 3개의 로그 버튼 */}
      <div className="grid grid-cols-3 gap-4">
        <LogButton
          category="meal"
          icon={<Utensils className="w-6 h-6" />}
          label="식사 기록"
          count={todayStats.meal}
          onLog={() => handleLog('meal')}
          isLoading={loadingCategory === 'meal'}
          isSuccess={successCategory === 'meal'}
        />
        <LogButton
          category="exercise"
          icon={<Dumbbell className="w-6 h-6" />}
          label="운동 완료"
          count={todayStats.exercise}
          onLog={() => handleLog('exercise')}
          isLoading={loadingCategory === 'exercise'}
          isSuccess={successCategory === 'exercise'}
        />
        <LogButton
          category="medication"
          icon={<Pill className="w-6 h-6" />}
          label="복약 완료"
          count={todayStats.medication}
          onLog={() => handleLog('medication')}
          isLoading={loadingCategory === 'medication'}
          isSuccess={successCategory === 'medication'}
        />
      </div>

      {/* 성공 토스트 메시지 */}
      {successCategory && (
        <div className="mt-4 p-3 bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] text-sm rounded-lg text-center font-medium">
          ✓ {categoryLabels[successCategory]} 기록이 저장되었습니다!
        </div>
      )}

      {/* 안내 문구 */}
      <p className="mt-4 text-xs text-gray-400 text-center">
        버튼을 눌러 상세 정보를 입력하세요
      </p>

      {/* 모달들 */}
      <MealLogModal
        isOpen={openModal === 'meal'}
        onClose={() => setOpenModal(null)}
        onSuccess={() => handleModalSuccess('meal')}
      />
      <ExerciseLogModal
        isOpen={openModal === 'exercise'}
        onClose={() => setOpenModal(null)}
        onSuccess={() => handleModalSuccess('exercise')}
      />
      <MedicationLogModal
        isOpen={openModal === 'medication'}
        onClose={() => setOpenModal(null)}
        onSuccess={() => handleModalSuccess('medication')}
      />
    </div>
  )
}
