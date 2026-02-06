'use client'

import { useState } from 'react'
import { Loader2, TrendingUp, Activity, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/app/components/Toast'

interface AdminTestClientProps {
  userId: string
}

export default function AdminTestClient({ userId }: AdminTestClientProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { showToast, ToastComponent } = useToast()

  const handleManipulateScore = async () => {
    const targetUserId = prompt('점수를 조작할 사용자 ID를 입력하세요:')
    const score = prompt('설정할 점수를 입력하세요 (0-10):')
    const date = prompt('날짜를 입력하세요 (YYYY-MM-DD, 빈 값이면 오늘):') || new Date().toISOString().split('T')[0]

    if (!targetUserId || !score) {
      showToast('사용자 ID와 점수를 입력해주세요.', 'warning')
      return
    }

    const scoreNum = parseFloat(score)
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
      showToast('점수는 0-10 사이의 숫자여야 합니다.', 'warning')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/manipulate-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          score: scoreNum,
          date
        })
      })

      const result = await response.json()
      if (result.success) {
        showToast(`점수가 ${scoreNum}점으로 설정되었습니다.`, 'success')
      } else {
        showToast(result.error || '점수 조작에 실패했습니다.', 'error')
      }
    } catch (error) {
      console.error('점수 조작 에러:', error)
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateFakeLog = async () => {
    const targetUserId = prompt('가짜 로그를 생성할 사용자 ID를 입력하세요:')
    const category = prompt('카테고리를 입력하세요 (meal/exercise/medication/sleep):')
    const count = prompt('생성할 로그 개수를 입력하세요 (1-30):')

    if (!targetUserId || !category || !count) {
      showToast('모든 값을 입력해주세요.', 'warning')
      return
    }

    if (!['meal', 'exercise', 'medication', 'sleep'].includes(category)) {
      showToast('카테고리는 meal, exercise, medication, sleep 중 하나여야 합니다.', 'warning')
      return
    }

    const countNum = parseInt(count)
    if (isNaN(countNum) || countNum < 1 || countNum > 30) {
      showToast('로그 개수는 1-30 사이의 숫자여야 합니다.', 'warning')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/create-fake-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          category,
          count: countNum
        })
      })

      const result = await response.json()
      if (result.success) {
        showToast(`${countNum}개의 ${category} 로그가 생성되었습니다.`, 'success')
      } else {
        showToast(result.error || '가짜 로그 생성에 실패했습니다.', 'error')
      }
    } catch (error) {
      console.error('가짜 로그 생성 에러:', error)
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkCreateLogs = async () => {
    const targetUserId = prompt('가짜 로그를 생성할 사용자 ID를 입력하세요:')
    const days = prompt('과거 며칠치 로그를 생성할까요? (1-30):')

    if (!targetUserId || !days) {
      showToast('사용자 ID와 일수를 입력해주세요.', 'warning')
      return
    }

    const daysNum = parseInt(days)
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      showToast('일수는 1-30 사이의 숫자여야 합니다.', 'warning')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/bulk-create-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: targetUserId,
          days: daysNum
        })
      })

      const result = await response.json()
      if (result.success) {
        showToast(`과거 ${daysNum}일치 로그가 생성되었습니다.`, 'success')
      } else {
        showToast(result.error || '일괄 로그 생성에 실패했습니다.', 'error')
      }
    } catch (error) {
      console.error('일괄 로그 생성 에러:', error)
      showToast('네트워크 오류가 발생했습니다.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">관리자 테스트 페이지</h1>
        <p className="text-gray-600 text-lg">랭킹 점수 조작 및 가짜 활동 로그 생성</p>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900 mb-1">⚠️ 관리자 전용 기능</h3>
            <p className="text-red-800 text-sm">
              이 페이지는 관리자만 접근할 수 있습니다. 데이터를 조작하기 전에 신중하게 확인하세요.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 랭킹 점수 조작 */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-[#2DD4BF]" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">랭킹 점수 조작</h2>
          </div>
          <p className="text-gray-600 mb-4 text-base">
            특정 사용자의 특정 날짜 점수를 직접 설정합니다.
          </p>
          <button
            onClick={handleManipulateScore}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#2DD4BF] hover:bg-[#2DD4BF]/90 text-white rounded-lg font-semibold text-base md:text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                처리 중...
              </>
            ) : (
              '점수 조작하기'
            )}
          </button>
        </div>

        {/* 가짜 로그 생성 (단일) */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-orange-500" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">가짜 로그 생성</h2>
          </div>
          <p className="text-gray-600 mb-4 text-base">
            특정 사용자에게 오늘 날짜로 가짜 활동 로그를 생성합니다.
          </p>
          <button
            onClick={handleCreateFakeLog}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-base md:text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                처리 중...
              </>
            ) : (
              '로그 생성하기'
            )}
          </button>
        </div>

        {/* 일괄 로그 생성 */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">일괄 로그 생성</h2>
          </div>
          <p className="text-gray-600 mb-4 text-base">
            특정 사용자에게 과거 며칠치의 랜덤 활동 로그를 일괄 생성합니다. (식단, 운동, 복약, 수면 랜덤 조합)
          </p>
          <button
            onClick={handleBulkCreateLogs}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-base md:text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                처리 중...
              </>
            ) : (
              '일괄 로그 생성하기'
            )}
          </button>
        </div>
      </div>

      {ToastComponent}
    </div>
  )
}
