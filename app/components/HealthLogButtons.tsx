'use client'

import { useState, useEffect } from 'react'
import { Utensils, Dumbbell, Pill, Check, Loader2 } from 'lucide-react'

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

  const handleLog = async (category: CategoryType) => {
    setLoadingCategory(category)
    setSuccessCategory(null)
    setError(null)

    try {
      const response = await fetch('/api/health-logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include', // 쿠키 포함
        body: JSON.stringify({ 
          category,
          // ⚠️ user_id는 서버에서 자동으로 추가됨 (클라이언트에서 보내지 않음)
        })
      })

      const data = await response.json()

      if (data.success) {
        // 성공 애니메이션
        setSuccessCategory(category)
        setTodayStats(prev => ({
          ...prev,
          [category]: prev[category] + 1
        }))

        // 3초 후 성공 상태 초기화
        setTimeout(() => {
          setSuccessCategory(null)
        }, 3000)
      } else {
        // 에러 메시지 개선
        let errorMessage = data.error || '기록 저장에 실패했습니다.'
        
        if (data.code === '42501' || data.error?.includes('RLS') || data.error?.includes('정책')) {
          errorMessage = '권한 오류: 로그인 상태를 확인해주세요. 문제가 계속되면 페이지를 새로고침하세요.'
        } else if (response.status === 401) {
          errorMessage = '로그인이 필요합니다. 다시 로그인해주세요.'
        } else if (data.hint) {
          errorMessage = `${errorMessage}\n\n💡 ${data.hint}`
        }
        
        setError(errorMessage)
        console.error('❌ [Health Logs] 저장 실패:', data)
      }
    } catch (err) {
      console.error('기록 저장 실패:', err)
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    } finally {
      setLoadingCategory(null)
    }
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
        버튼을 누르면 현재 시간으로 자동 기록됩니다
      </p>
    </div>
  )
}
