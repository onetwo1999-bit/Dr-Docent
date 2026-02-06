'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Loader2, TrendingDown, TrendingUp, FileText } from 'lucide-react'
import MedicalDisclaimer from './MedicalDisclaimer'

type UserTier = 'Standard' | 'VIP'

interface HealthReportViewProps {
  userTier: UserTier
  userId: string
}

interface HealthStats {
  totalExerciseDays: number
  averageWeight: number
  totalMealDays: number
  totalMedicationDays: number
  monthlyData: { month: string; exercise: number; meal: number; medication: number }[]
}

interface VIPReport {
  biologicalAge: number
  chronologicalAge: number
  futureRiskReduction: number
  peerRanking: number
  muscleMassPercentile: number
  doctorLetter: string
}

export default function HealthReportView({ userTier, userId }: HealthReportViewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [healthStats, setHealthStats] = useState<HealthStats | null>(null)
  const [vipReport, setVipReport] = useState<VIPReport | null>(null)

  useEffect(() => {
    fetchReportData()
  }, [userId])

  const fetchReportData = async () => {
    setIsLoading(true)
    try {
      // 최근 1년 데이터 조회
      const today = new Date()
      const oneYearAgo = new Date(today)
      oneYearAgo.setFullYear(today.getFullYear() - 1)

      const response = await fetch(
        `/api/health-logs?start_date=${oneYearAgo.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`
      )
      const data = await response.json()

      if (data.success && data.data) {
        const logs = data.data
        const stats = calculateHealthStats(logs)
        setHealthStats(stats)

        if (userTier === 'VIP') {
          const vip = generateVIPReport(stats, logs)
          setVipReport(vip)
        }
      }
    } catch (error) {
      console.error('리포트 데이터 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateHealthStats = (logs: any[]): HealthStats => {
    const exerciseDays = new Set<string>()
    const mealDays = new Set<string>()
    const medicationDays = new Set<string>()
    const weights: number[] = []
    const monthlyMap = new Map<string, { exercise: number; meal: number; medication: number }>()

    logs.forEach(log => {
      const date = new Date(log.logged_at)
      const dateStr = date.toISOString().split('T')[0]
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { exercise: 0, meal: 0, medication: 0 })
      }
      const monthData = monthlyMap.get(monthKey)!

      if (log.category === 'exercise') {
        exerciseDays.add(dateStr)
        monthData.exercise++
      } else if (log.category === 'meal') {
        mealDays.add(dateStr)
        monthData.meal++
      } else if (log.category === 'medication') {
        medicationDays.add(dateStr)
        monthData.medication++
      }

      if (log.weight_kg) {
        weights.push(Number(log.weight_kg))
      }
    })

    const monthlyData = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month]) => {
        const data = monthlyMap.get(month)!
        return {
          month: month.slice(5), // "01", "02" 등
          exercise: data.exercise,
          meal: data.meal,
          medication: data.medication
        }
      })

    return {
      totalExerciseDays: exerciseDays.size,
      averageWeight: weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0,
      totalMealDays: mealDays.size,
      totalMedicationDays: medicationDays.size,
      monthlyData
    }
  }

  const generateVIPReport = (stats: HealthStats, logs: any[]): VIPReport => {
    // 생체 나이 계산 (간단한 시뮬레이션)
    const baseAge = 42 // 예시
    const exerciseBonus = Math.min(stats.totalExerciseDays / 10, 5) // 운동일수에 따른 감소
    const medicationBonus = stats.totalMedicationDays > 100 ? 2 : 0 // 복약 꾸준히 하면 보너스
    const biologicalAge = Math.max(30, baseAge - exerciseBonus - medicationBonus)

    // 미래 위험도 감소 시뮬레이션
    const futureRiskReduction = Math.min(30, Math.floor(stats.totalExerciseDays / 5) + Math.floor(stats.totalMedicationDays / 20))

    // 동년배 랭킹 (상위 퍼센트)
    const peerRanking = Math.max(5, 100 - Math.floor(stats.totalExerciseDays / 2))

    // 근육량 퍼센타일 (시뮬레이션)
    const muscleMassPercentile = Math.min(95, 50 + Math.floor(stats.totalExerciseDays / 3))

    // 닥터스 레터 생성
    const doctorLetter = generateDoctorLetter(stats, biologicalAge, baseAge, futureRiskReduction, peerRanking)

    return {
      biologicalAge,
      chronologicalAge: baseAge,
      futureRiskReduction,
      peerRanking,
      muscleMassPercentile,
      doctorLetter
    }
  }

  const generateDoctorLetter = (
    stats: HealthStats,
    bioAge: number,
    chronAge: number,
    riskReduction: number,
    ranking: number
  ): string => {
    const ageDiff = chronAge - bioAge
    const ageComment = ageDiff > 0 
      ? `축하합니다. 신체 나이는 ${bioAge}세로, 실제 나이보다 ${ageDiff}세 젊습니다.`
      : `현재 신체 나이는 ${bioAge}세입니다.`

    return `환자님께,

이번 1년간의 건강 데이터를 종합적으로 분석한 결과를 말씀드립니다.

${ageComment} 이는 꾸준한 건강 관리의 결과로 보입니다.

운동 기록을 ${stats.totalExerciseDays}일, 식단 관리를 ${stats.totalMealDays}일, 복약을 ${stats.totalMedicationDays}일 꾸준히 챙기신 점이 인상적입니다. 이러한 습관이 신체 나이를 낮추는 데 기여했습니다.

미래 예측 시뮬레이션 결과, 현재의 생활 패턴을 유지하시면 3년 후 당뇨 위험도가 약 ${riskReduction}% 감소할 것으로 예상됩니다. 또한 동년배 대비 상위 ${ranking}%에 해당하는 근육량을 보유하고 계십니다.

건강한 노화를 위해서는 현재의 운동 습관을 유지하시고, 식단의 균형을 더욱 신경 쓰시면 좋겠습니다. 특히 복약 관리를 꾸준히 하시는 것이 중요합니다.

앞으로도 건강한 생활 습관을 유지하시길 바랍니다.

닥터 도슨`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
      </div>
    )
  }

  // Standard 유저 렌더링
  if (userTier === 'Standard') {
    return (
      <div className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">건강 리포트</h1>

          {/* 단순 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">총 운동</div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {healthStats?.totalExerciseDays || 0}일
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">평균 체중</div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {healthStats?.averageWeight ? `${healthStats.averageWeight.toFixed(1)}kg` : '-'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">식단 기록</div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {healthStats?.totalMealDays || 0}일
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">복약 기록</div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {healthStats?.totalMedicationDays || 0}일
              </div>
            </div>
          </div>

          {/* 단순 선 그래프 */}
          {healthStats?.monthlyData && healthStats.monthlyData.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">월별 활동 추이</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={healthStats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Line type="monotone" dataKey="exercise" stroke="#3b82f6" strokeWidth={2} name="운동" />
                  <Line type="monotone" dataKey="meal" stroke="#f97316" strokeWidth={2} name="식단" />
                  <Line type="monotone" dataKey="medication" stroke="#22c55e" strokeWidth={2} name="복약" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 면책 조항 */}
          <div className="mt-8">
            <MedicalDisclaimer variant="full" />
          </div>
        </div>
      </div>
    )
  }

  // VIP 유저 렌더링
  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-[#d4af37] mb-2">프리미엄 건강 리포트</h1>
          <p className="text-gray-400 text-lg">1년간의 건강 데이터 심층 분석</p>
        </div>

        {/* 생체 나이 분석 */}
        {vipReport && (
          <div className="mb-12 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-8 border border-[#d4af37]/20">
            <h2 className="text-xl md:text-2xl font-bold text-[#d4af37] mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              생체 나이 분석
            </h2>
            <div className="flex items-baseline gap-4">
              <div className="text-5xl md:text-6xl font-bold text-white">
                {vipReport.biologicalAge}세
              </div>
              <div className="flex flex-col">
                {vipReport.chronologicalAge - vipReport.biologicalAge > 0 ? (
                  <>
                    <div className="flex items-center gap-2 text-[#d4af37] text-xl md:text-2xl font-semibold">
                      <TrendingDown className="w-6 h-6" />
                      -{vipReport.chronologicalAge - vipReport.biologicalAge}세
                    </div>
                    <div className="text-gray-400 text-sm">실제 나이보다 젊습니다</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-gray-400 text-xl md:text-2xl font-semibold">
                      <TrendingUp className="w-6 h-6" />
                      {Math.abs(vipReport.chronologicalAge - vipReport.biologicalAge)}세
                    </div>
                    <div className="text-gray-400 text-sm">실제 나이와 유사합니다</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 미래 예측 시뮬레이션 */}
        {vipReport && (
          <div className="mb-12 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-8 border border-[#d4af37]/20">
            <h2 className="text-xl md:text-2xl font-bold text-[#d4af37] mb-6">미래 예측 시뮬레이션</h2>
            <div className="mb-4">
              <p className="text-lg text-gray-300 mb-4">
                이대로 유지 시 3년 후 당뇨 위험도 <span className="text-[#d4af37] font-bold">{vipReport.futureRiskReduction}% 감소</span>
              </p>
              <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#d4af37] to-[#e5c04a] h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, vipReport.futureRiskReduction)}%` }}
                >
                  <span className="text-xs font-semibold text-[#0f172a]">
                    {vipReport.futureRiskReduction}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 동년배 랭킹 */}
        {vipReport && (
          <div className="mb-12 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-8 border border-[#d4af37]/20">
            <h2 className="text-xl md:text-2xl font-bold text-[#d4af37] mb-6">동년배 랭킹</h2>
            <div className="text-center mb-8">
              <div className="text-4xl md:text-5xl font-bold text-[#d4af37] mb-2">
                상위 {vipReport.peerRanking}%
              </div>
              <p className="text-lg text-gray-300">근육량입니다</p>
            </div>
            {/* 방사형 차트 */}
            <div className="max-w-md mx-auto">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={[
                  { subject: '근육량', score: vipReport.muscleMassPercentile, fullMark: 100 },
                  { subject: '심혈관', score: 85, fullMark: 100 },
                  { subject: '대사', score: 78, fullMark: 100 },
                  { subject: '활동량', score: Math.min(100, (healthStats?.totalExerciseDays || 0) * 2), fullMark: 100 },
                  { subject: '영양', score: Math.min(100, (healthStats?.totalMealDays || 0) * 1.5), fullMark: 100 },
                ]}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#d4af37', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Radar
                    name="점수"
                    dataKey="score"
                    stroke="#d4af37"
                    fill="#d4af37"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #d4af37',
                      borderRadius: '8px',
                      color: '#d4af37'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 닥터스 레터 */}
        {vipReport && (
          <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-8 md:p-12 border border-[#d4af37]/20">
            <h2 className="text-xl md:text-2xl font-bold text-[#d4af37] mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              닥터스 레터
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="text-gray-200 text-base md:text-lg leading-relaxed whitespace-pre-line font-serif">
                {vipReport.doctorLetter}
              </div>
              <div className="mt-6 pt-6 border-t border-[#d4af37]/30">
                <MedicalDisclaimer variant="compact" className="text-amber-200" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
