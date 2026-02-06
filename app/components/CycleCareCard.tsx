'use client'

import { useState, useEffect } from 'react'
import { Heart, Calendar, AlertCircle, Check, Loader2, ChevronRight } from 'lucide-react'

// 한국 시간 기준 오늘 날짜 문자열 반환
function getTodayLocalString(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

interface CycleData {
  id: string
  start_date: string
  end_date: string | null
  cycle_length: number | null
  note: string | null
  status?: 'ongoing' | 'completed'
}

interface Prediction {
  averageCycleLength: number
  predictedNextDate: string | null
  confidence: 'low' | 'medium' | 'high'
  dataPoints: number
}

interface LateStatus {
  isLate: boolean
  daysLate: number
}

interface CycleResponse {
  cycles: CycleData[]
  prediction: Prediction
  lateStatus: LateStatus
  currentCycle: CycleData | null
  totalRecords: number
}

export default function CycleCareCard() {
  const [data, setData] = useState<CycleResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchCycleData()
  }, [])

  const fetchCycleData = async () => {
    try {
      console.log('🔄 [Cycle Data] 데이터 조회 시작')
      const response = await fetch('/api/cycle-logs', {
        credentials: 'include'
      })
      
      console.log('📡 [Cycle Data] 응답 상태:', response.status)
      
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: `서버 오류 (${response.status})` }
        }
        console.error('❌ [Cycle Data] 조회 실패:', response.status, errorData)
        return
      }
      
      const result = await response.json()
      console.log('✅ [Cycle Data] 조회 성공:', result)
      
      if (result.success) {
        setData(result.data)
        console.log('📊 [Cycle Data] 현재 진행 중인 기록:', result.data?.currentCycle)
      } else {
        console.error('❌ [Cycle Data] 데이터 조회 실패:', result.error)
      }
    } catch (error: any) {
      console.error('❌ [Cycle Data] 네트워크 에러:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartCycle = async () => {
    setIsSubmitting(true)
    setMessage(null)

    try {
      const today = getTodayLocalString()
      console.log('🔄 [Cycle Start] 요청 시작:', { action: 'start', start_date: today })
      
      const response = await fetch('/api/cycle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'start',
          start_date: today
        })
      })

      console.log('📡 [Cycle Start] 응답 상태:', response.status, response.statusText)

      // 응답 상태 확인
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          errorData = { error: `서버 오류 (${response.status})` }
        }
        console.error('❌ [Cycle Start] API 에러:', response.status, errorData)
        setMessage(errorData.error || errorData.details || `서버 오류 (${response.status})`)
        return
      }

      const result = await response.json()
      console.log('✅ [Cycle Start] 응답 데이터:', result)

      if (result.success) {
        setMessage('그날 시작이 기록되었어요 💕')
        // 데이터 새로고침
        await fetchCycleData()
        // 캘린더 새로고침을 위한 이벤트 발생
        window.dispatchEvent(new CustomEvent('cycle-updated'))
      } else {
        setMessage(result.error || result.details || '기록 중 오류가 발생했습니다.')
      }
    } catch (error: any) {
      console.error('❌ [Cycle Start] 네트워크 에러:', error)
      setMessage(`네트워크 오류: ${error?.message || '인터넷 연결을 확인해주세요.'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEndCycle = async () => {
    setIsSubmitting(true)
    setMessage(null)

    try {
      const today = getTodayLocalString()
      
      const response = await fetch('/api/cycle-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'end',
          end_date: today
        })
      })

      // 응답 상태 확인
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }))
        console.error('❌ [Cycle End] API 에러:', response.status, errorData)
        setMessage(errorData.error || errorData.details || `서버 오류 (${response.status})`)
        return
      }

      const result = await response.json()

      if (result.success) {
        setMessage('그날 종료가 기록되었어요 ✨')
        // 데이터 새로고침
        await fetchCycleData()
        // 캘린더 새로고침을 위한 이벤트 발생
        window.dispatchEvent(new CustomEvent('cycle-updated'))
      } else {
        setMessage(result.error || result.details || '기록 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('❌ [Cycle End] 네트워크 에러:', error)
      setMessage('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null
    const today = new Date()
    const target = new Date(dateStr)
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'high': return '높음'
      case 'medium': return '보통'
      default: return '낮음'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#2DD4BF] animate-spin" />
        </div>
      </div>
    )
  }

  const isInProgress = data?.currentCycle !== null
  const daysUntil = getDaysUntil(data?.prediction.predictedNextDate || null)

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
            <Heart className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">그날 케어</h3>
            <p className="text-xs text-gray-400">Soft Care</p>
          </div>
        </div>
        
        {/* 상태 표시 */}
        {isInProgress ? (
          <span className="px-3 py-1 bg-pink-50 text-pink-500 text-xs rounded-full font-medium">
            진행 중
          </span>
        ) : data?.lateStatus.isLate ? (
          <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs rounded-full font-medium">
            {data.lateStatus.daysLate}일 지연
          </span>
        ) : daysUntil !== null && daysUntil <= 7 && daysUntil >= 0 ? (
          <span className="px-3 py-1 bg-[#2DD4BF]/10 text-[#2DD4BF] text-xs rounded-full font-medium">
            D-{daysUntil}
          </span>
        ) : null}
      </div>

      {/* 지연 경고 메시지 (페르소나 톤) */}
      {data?.lateStatus.isLate && !isInProgress && (
        <div className="mb-4 p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
          <p className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              선생님, 이번 달 소식이 조금 늦어지시는 것 같아요. 
              몸 상태는 어떠신가요? 컨디션에 큰 변화가 있다면 
              병원 검사를 받아보시는 것도 좋을 것 같아요. 💕
            </span>
          </p>
        </div>
      )}

      {/* 예측 정보 */}
      {data?.prediction.predictedNextDate && !isInProgress && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">다음 예정일</span>
            <span className="text-sm font-medium text-gray-900">
              {formatDate(data.prediction.predictedNextDate)}
              {daysUntil !== null && daysUntil >= 0 && (
                <span className="ml-2 text-[#2DD4BF]">(D-{daysUntil})</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">평균 주기</span>
            <span className="text-xs text-gray-500">
              {data.prediction.averageCycleLength}일 
              <span className="text-gray-400 ml-1">
                (신뢰도: {getConfidenceLabel(data.prediction.confidence)})
              </span>
            </span>
          </div>
        </div>
      )}

      {/* 현재 진행 중인 경우 */}
      {isInProgress && data?.currentCycle && (
        <div className="mb-4 p-3 bg-pink-50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-pink-600">시작일</span>
            <span className="text-sm font-medium text-pink-700">
              {formatDate(data.currentCycle.start_date)}
            </span>
          </div>
          <p className="mt-2 text-xs text-pink-500">
            선생님, 편안한 하루 보내세요 💕
          </p>
        </div>
      )}

      {/* 버튼 영역 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleStartCycle}
          disabled={isSubmitting || isInProgress}
          className={`
            py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2
            ${isInProgress
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
            }
          `}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Heart className="w-4 h-4" />
              그날 시작
            </>
          )}
        </button>
        
        <button
          onClick={handleEndCycle}
          disabled={isSubmitting || !isInProgress}
          className={`
            py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2
            ${!isInProgress
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#2DD4BF] text-white hover:bg-[#26b8a5]'
            }
          `}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              그날 종료
            </>
          )}
        </button>
      </div>

      {/* 성공 메시지 */}
      {message && (
        <div className={`mt-3 p-2 rounded-lg text-sm text-center ${
          message.includes('오류') ? 'bg-red-50 text-red-600' : 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
        }`}>
          {message}
        </div>
      )}

      {/* 상세 보기 토글 */}
      {data && data.totalRecords > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-4 w-full flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600"
        >
          {showDetails ? '접기' : '기록 보기'}
          <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </button>
      )}

      {/* 최근 기록 목록 */}
      {showDetails && data?.cycles && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-gray-400 mb-2">최근 기록 ({data.totalRecords}건)</p>
          {data.cycles.slice(0, 5).map((cycle) => (
            <div key={cycle.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{formatDate(cycle.start_date)}</span>
                {cycle.end_date && (
                  <span className="text-gray-400">~ {formatDate(cycle.end_date)}</span>
                )}
              </div>
              {cycle.cycle_length && (
                <span className="text-xs text-gray-400">{cycle.cycle_length}일 주기</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 안내 문구 */}
      <p className="mt-4 text-xs text-gray-400 text-center">
        기록이 쌓이면 더 정확한 예측이 가능해요
      </p>
    </div>
  )
}
