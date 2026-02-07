'use client'

import { useState, useEffect } from 'react'
import { FileText, AlertTriangle, CheckCircle, Loader2, Activity, ArrowUpRight, X } from 'lucide-react'
import { getAgeFromBirthDate, getAgeGroupHealthGuide } from '@/utils/health'

interface Profile {
  birth_date: string | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions?: string | null
  chronic_diseases?: string | null
  medications: string | null
  bmi?: number | null
}

interface HealthLog {
  category: string
  logged_at: string
  note?: string
  meal_description?: string | null
  sleep_duration_hours?: number | null
}

interface HealthReportProps {
  profile: Profile | null
  userId: string
}

// BMI 계산
function calculateBMI(height: number | null, weight: number | null): number | null {
  if (!height || !weight || height <= 0) return null
  const heightInMeters = height / 100
  return weight / (heightInMeters * heightInMeters)
}

// BMI 카테고리 판정
function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return '저체중'
  if (bmi < 23) return '정상'
  if (bmi < 25) return '과체중'
  if (bmi < 30) return '비만 1단계'
  return '비만 2단계'
}

export default function HealthReport({ profile, userId }: HealthReportProps) {
  const [report, setReport] = useState<{
    status: string
    caution: string
    feedback: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchReportData()
  }, [profile, userId])

  useEffect(() => {
    const openModal = () => setIsModalOpen(true)
    window.addEventListener('open-health-report-modal', openModal)
    return () => window.removeEventListener('open-health-report-modal', openModal)
  }, [])

  const fetchReportData = async () => {
    setIsLoading(true)
    try {
      // 최근 7일 건강 로그 조회
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(today.getDate() - 7)
      
      const logsResponse = await fetch(
        `/api/health-logs?start_date=${weekAgo.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`
      )
      const logsData = await logsResponse.json()
      
      if (logsData.success) {
        setHealthLogs(logsData.data || [])
      }

      // 리포트 생성
      generateReport(logsData.data || [])
    } catch (error) {
      console.error('리포트 데이터 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateReport = (logs: HealthLog[]) => {
    if (!profile || !profile.height || !profile.weight) {
      setReport({
        status: '프로필 정보가 부족합니다.',
        caution: '키와 몸무게를 입력해주세요.',
        feedback: '정확한 건강 리포트를 위해 프로필을 완성해주세요.'
      })
      return
    }

    const bmi = calculateBMI(profile.height, profile.weight)
    const bmiCategory = bmi ? getBMICategory(bmi) : null
    
    // 최근 7일 기록 분석
    const mealLogs = logs.filter(l => l.category === 'meal')
    const exerciseLogs = logs.filter(l => l.category === 'exercise')
    const medicationLogs = logs.filter(l => l.category === 'medication')
    const sleepLogs = logs.filter(l => l.category === 'sleep')
    
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    // 연속 복약 일수 + 오늘 복약 기록 여부
    const medicationDates = medicationLogs
      .map(l => l.logged_at.split('T')[0])
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort()
      .reverse()
    const hasMedicationToday = medicationDates.includes(today)
    
    let consecutiveDays = 0
    for (let i = 0; i < medicationDates.length; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const checkDateStr = checkDate.toISOString().split('T')[0]
      if (medicationDates.includes(checkDateStr)) {
        consecutiveDays++
      } else {
        break
      }
    }

    // 수면: 평균 시간, 어제 기록 여부
    const sleepDurations = sleepLogs
      .map(l => l.sleep_duration_hours)
      .filter((h): h is number => h != null && !Number.isNaN(Number(h)))
    const avgSleepHours = sleepDurations.length > 0
      ? sleepDurations.reduce((a, b) => a + b, 0) / sleepDurations.length
      : 0
    const sleepDates = sleepLogs.map(l => l.logged_at.split('T')[0])
    const hasSleepYesterday = sleepDates.includes(yesterdayStr)

    // 상태 메시지 생성 (chronic_diseases 우선, 없으면 conditions 사용)
    const diseases = profile.chronic_diseases || profile.conditions
    let status = ''
    if (diseases?.includes('고혈압') || diseases?.includes('혈압')) {
      status = '현재 혈압 관리가 필요한 상태이며, '
    } else if (bmiCategory === '과체중' || bmiCategory === '비만') {
      status = '체중 관리가 필요한 상태이며, '
    } else {
      status = '전반적으로 건강한 상태이며, '
    }
    
    if (mealLogs.length >= 14) {
      status += '최근 식단 기록이 아주 긍정적입니다.'
    } else if (mealLogs.length >= 7) {
      status += '최근 식단 기록이 양호합니다.'
    } else {
      status += '식단 기록을 더 꾸준히 하시면 좋을 것 같아요.'
    }

    // 주의사항 생성 (chronic_diseases 우선, 이미 선언된 diseases 변수 재사용)
    let caution = ''
    if (diseases?.includes('고혈압') || diseases?.includes('혈압')) {
      caution = '염분 섭취를 조절하고, 급격한 유산소 운동은 피하세요.'
    } else if (bmiCategory === '과체중' || bmiCategory === '비만') {
      caution = '규칙적인 운동과 균형 잡힌 식단을 권장드립니다.'
    } else if (bmiCategory === '저체중') {
      caution = '충분한 영양 섭취와 적절한 운동을 병행하세요.'
    } else {
      caution = '현재 상태를 유지하기 위해 꾸준한 관리가 필요합니다.'
    }

    // 피드백 생성 (기본 + 질환별 맞춤 + 데이터 누락 넛지 + 연령대 건강팁 + 멘탈 케어)
    let feedback = ''
    if (consecutiveDays >= 3) {
      feedback = `${consecutiveDays}일 연속 복약 성공! 꾸준한 습관이 선생님의 건강 자산입니다.`
    } else if (medicationLogs.length > 0) {
      feedback = '복약 기록을 꾸준히 하시고 계시네요. 계속 이렇게 관리하시면 좋을 것 같아요.'
    } else if (exerciseLogs.length >= 3) {
      feedback = '운동 습관이 잘 형성되고 있어요. 꾸준히 유지하시면 건강에 큰 도움이 될 거예요.'
    } else if (mealLogs.length >= 10) {
      feedback = '식단 기록이 잘 되어 있어요. 이렇게 꾸준히 기록하시면 건강 관리에 도움이 됩니다.'
    } else {
      feedback = '건강 관리를 위해 식사, 운동, 복약 기록을 꾸준히 남겨보세요.'
    }

    // 질환별 맞춤: 통풍 + 최근 식단에 단백질 언급 시 식이 가이드
    const hasGout = diseases?.toLowerCase().includes('통풍')
    const proteinKeywords = ['고기', '닭', '생선', '돈까스', '육회', '달걀', '계란', '두부', '콩', '단백질', '찜닭', '삼겹']
    const recentMealText = mealLogs
      .slice(0, 14)
      .map(l => (l.meal_description || l.note || '').toLowerCase())
      .join(' ')
    const hasRecentProtein = hasGout && proteinKeywords.some(kw => recentMealText.includes(kw))
    if (hasRecentProtein) {
      feedback += ' 단백질 섭취 시 식이섬유(채소)를 함께 늘려보시는 건 어떨까요?'
    }

    // 데이터 입력 넛지: 오늘 복약 기록 없음
    if (!hasMedicationToday && medicationLogs.length > 0) {
      feedback += ' 오늘 약 복용 기록이 아직 없네요. 잊지 말고 챙겨주세요!'
    } else if (!hasMedicationToday) {
      feedback += ' 오늘 복약 기록이 아직 없어요. 복용하셨다면 기록해 주세요!'
    }

    // 데이터 입력 넛지: 평소 수면 기록하다 어제 비었을 때
    if (avgSleepHours >= 6 && avgSleepHours <= 8 && sleepDurations.length >= 3 && !hasSleepYesterday) {
      feedback += ' 어제 수면 기록이 빠졌어요. 트레이너님의 회복 패턴 분석을 위해 기록 부탁드려요!'
    }

    // 연령대별 건강 팁 (신체 카드에서 제거한 스트레스 관리 등 → AI 의견으로 통합)
    const currentAge = getAgeFromBirthDate(profile.birth_date)
    const ageTip = getAgeGroupHealthGuide(currentAge)
    if (ageTip) {
      feedback += ` ${ageTip}`
    }

    // 멘탈 케어: 따뜻한 격려 한마디
    feedback += ' 기록을 남기는 것만으로도 이미 충분히 건강한 하루를 만들고 계십니다.'

    setReport({ status, caution, feedback })
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#2DD4BF] animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile || !profile.height || !profile.weight) {
    return (
      <div className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-200 shadow-sm">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">프로필 정보를 입력하면</p>
          <p className="text-gray-400 text-sm">맞춤형 건강 리포트를 확인할 수 있어요</p>
        </div>
      </div>
    )
  }

  const bmi = calculateBMI(profile.height, profile.weight)
  const bmiCategory = bmi ? getBMICategory(bmi) : null

  // 컴팩트한 요약 카드: 긍정 피드백 한 줄, 길면 앞부분 선명 + 나머지 그라데이션 페이드로 탭 유도
  const VISIBLE_LINES = 2
  const lineHeightRem = 1.375
  const maxHeightRem = VISIBLE_LINES * lineHeightRem
  const showFade = report && report.feedback.length > 36

  const SummaryCard = () => (
    <div
      className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-[#2DD4BF] transition-all duration-300 cursor-pointer group"
      onClick={() => setIsModalOpen(true)}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2DD4BF]/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#2DD4BF]" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI 건강 리포트</h3>
            <p className="text-xs text-gray-400">단기 신체 리포트</p>
          </div>
        </div>
        <ArrowUpRight className="w-5 h-5 text-gray-300 group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>

      {/* 긍정 피드백 한줄: 짧으면 통째로, 길면 일부 선명 + 아래쪽 페이드 */}
      {report && (
        <div className="relative rounded-lg bg-[#2DD4BF]/5 border border-[#2DD4BF]/15 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-[#2DD4BF] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0 relative">
              <p
                className="text-sm text-gray-700 leading-[1.375] pr-1"
                style={{
                  maxHeight: showFade ? `${maxHeightRem}rem` : undefined,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: showFade ? VISIBLE_LINES : undefined,
                  WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}
              >
                {report.feedback}
              </p>
              {/* 나머지 구간 그라데이션 페이드 (길 때만) */}
              {showFade && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none rounded-b-lg"
                  style={{
                    background: 'linear-gradient(to top, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.75) 25%, transparent 100%)',
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>
          {showFade && (
            <p className="text-xs text-[#2DD4BF] mt-2 font-medium">탭하면 전체 보기</p>
          )}
        </div>
      )}
    </div>
  )

  // 상세 모달
  const DetailModal = () => {
    if (!isModalOpen) return null

    return (
      <>
        {/* 배경 오버레이 (흐릿하게) */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={() => setIsModalOpen(false)}
        />
        
        {/* 모달 컨텐츠 */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#2DD4BF]/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#2DD4BF]" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">AI 건강 리포트</h3>
                  <p className="text-xs text-gray-400">단기 신체 리포트</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 상태 */}
            {report && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-3">
                    <Activity className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-1">현재 상태</h4>
                      <p className="text-sm text-blue-700 leading-relaxed">{report.status}</p>
                    </div>
                  </div>
                </div>

                {/* 주의사항 */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-1">주의사항</h4>
                      <p className="text-sm text-amber-700 leading-relaxed">{report.caution}</p>
                    </div>
                  </div>
                </div>

                {/* 피드백 */}
                <div className="p-4 bg-[#2DD4BF]/10 rounded-xl border border-[#2DD4BF]/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#2DD4BF] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#2DD4BF] mb-1">긍정 피드백</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{report.feedback}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

      {/* 기저질환 및 복용약물 요약 */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {(profile.chronic_diseases || profile.conditions) && (
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-600 mb-1">기저 질환</p>
            <p className="text-sm font-medium text-gray-900">
              {profile.chronic_diseases || profile.conditions}
            </p>
          </div>
        )}
        {profile.medications && (
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-purple-600 mb-1">복용 약물</p>
            <p className="text-sm font-medium text-gray-900">{profile.medications}</p>
          </div>
        )}
      </div>

            {/* 면책조항 */}
            <p className="mt-6 text-xs text-gray-400 text-center leading-relaxed">
              본 리포트는 입력된 정보와 기록을 기반으로 생성된 참고 자료이며,<br/>
              정확한 진단은 전문의와 상담하세요.
            </p>
          </div>
        </div>
      </>
    )
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

  if (!profile || !profile.height || !profile.weight) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">프로필 정보를 입력하면</p>
          <p className="text-gray-400 text-sm">맞춤형 건강 리포트를 확인할 수 있어요</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <SummaryCard />
      <DetailModal />
    </>
  )
}
