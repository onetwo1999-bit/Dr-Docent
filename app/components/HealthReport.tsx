'use client'

import { useState, useEffect } from 'react'
import { FileText, TrendingUp, AlertTriangle, CheckCircle, Loader2, Heart, Activity } from 'lucide-react'

interface Profile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

interface HealthLog {
  category: string
  logged_at: string
  note?: string
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

  useEffect(() => {
    fetchReportData()
  }, [profile, userId])

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
    
    // 연속 복약 일수 계산
    const today = new Date().toISOString().split('T')[0]
    const medicationDates = medicationLogs
      .map(l => l.logged_at.split('T')[0])
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort()
      .reverse()
    
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

    // 상태 메시지 생성
    let status = ''
    if (profile.conditions?.includes('고혈압') || profile.conditions?.includes('혈압')) {
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

    // 주의사항 생성
    let caution = ''
    if (profile.conditions?.includes('고혈압') || profile.conditions?.includes('혈압')) {
      caution = '염분 섭취를 조절하고, 급격한 유산소 운동은 피하세요.'
    } else if (bmiCategory === '과체중' || bmiCategory === '비만') {
      caution = '규칙적인 운동과 균형 잡힌 식단을 권장드립니다.'
    } else if (bmiCategory === '저체중') {
      caution = '충분한 영양 섭취와 적절한 운동을 병행하세요.'
    } else {
      caution = '현재 상태를 유지하기 위해 꾸준한 관리가 필요합니다.'
    }

    // 피드백 생성
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

    setReport({ status, caution, feedback })
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#2DD4BF] animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile || !profile.height || !profile.weight) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
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

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#2DD4BF]/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-[#2DD4BF]" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900">AI 건강 리포트</h3>
          <p className="text-xs text-gray-400">단기 신체 리포트</p>
        </div>
      </div>

      {/* BMI 요약 */}
      {bmi && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">BMI 지수</span>
            <span className="text-lg font-bold text-gray-900">{bmi.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">분류</span>
            <span className={`text-sm font-medium ${
              bmiCategory === '정상' ? 'text-green-600' :
              bmiCategory === '과체중' ? 'text-yellow-600' :
              bmiCategory === '저체중' ? 'text-blue-600' : 'text-red-600'
            }`}>
              {bmiCategory}
            </span>
          </div>
        </div>
      )}

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
        {profile.conditions && (
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-600 mb-1">기저 질환</p>
            <p className="text-sm font-medium text-gray-900">{profile.conditions}</p>
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
  )
}
