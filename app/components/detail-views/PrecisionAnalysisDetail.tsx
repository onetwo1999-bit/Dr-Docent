'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader2, Calendar, TrendingUp } from 'lucide-react'
import MedicalDisclaimer from '../MedicalDisclaimer'

type TabType = 'monthly' | 'yearly'

interface MonthlyData {
  month: string
  exercise: number
  meal: number
  medication: number
  sleep: number
}

interface YearlyData {
  year: string
  totalExercise: number
  totalMeal: number
  totalMedication: number
  totalSleep: number
  avgScore: number
}

export default function PrecisionAnalysisDetail() {
  const [tab, setTab] = useState<TabType>('monthly')
  const [isLoading, setIsLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [yearlyData, setYearlyData] = useState<YearlyData[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const today = new Date()
      const oneYearAgo = new Date(today)
      oneYearAgo.setFullYear(today.getFullYear() - 1)

      const response = await fetch(
        `/api/health-logs?start_date=${oneYearAgo.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`
      )
      const result = await response.json()

      if (result.success && result.data) {
        const logs = result.data as { logged_at: string; category: string; sleep_duration_hours?: number }[]

        const monthMap = new Map<string, { exercise: number; meal: number; medication: number; sleep: number }>()
        const yearMap = new Map<string, { exercise: Set<string>; meal: Set<string>; medication: Set<string>; sleep: Set<string>; scores: number[] }>()

        logs.forEach((log) => {
          const d = new Date(log.logged_at)
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          const yearKey = String(d.getFullYear())
          const dateStr = d.toISOString().split('T')[0]

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { exercise: 0, meal: 0, medication: 0, sleep: 0 })
          }
          const m = monthMap.get(monthKey)!

          if (!yearMap.has(yearKey)) {
            yearMap.set(yearKey, {
              exercise: new Set(),
              meal: new Set(),
              medication: new Set(),
              sleep: new Set(),
              scores: [],
            })
          }
          const y = yearMap.get(yearKey)!

          if (log.category === 'exercise') {
            m.exercise++
            y.exercise.add(dateStr)
          } else if (log.category === 'meal') {
            m.meal++
            y.meal.add(dateStr)
          } else if (log.category === 'medication') {
            m.medication++
            y.medication.add(dateStr)
          } else if (log.category === 'sleep') {
            m.sleep++
            y.sleep.add(dateStr)
          }
        })

        const monthly: MonthlyData[] = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, v]) => ({
            month: `${month.slice(5)}월`,
            exercise: v.exercise,
            meal: v.meal,
            medication: v.medication,
            sleep: v.sleep,
          }))
        setMonthlyData(monthly)

        const yearly: YearlyData[] = Array.from(yearMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([year, v]) => ({
            year: `${year}년`,
            totalExercise: v.exercise.size,
            totalMeal: v.meal.size,
            totalMedication: v.medication.size,
            totalSleep: v.sleep.size,
            avgScore: 0,
          }))
        setYearlyData(yearly)
      }
    } catch (err) {
      console.error('정밀 분석 데이터 조회 실패:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-[#2DD4BF] animate-spin" />
        <p className="mt-3 text-sm text-gray-500">데이터 분석 중...</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* 탭 */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
        <button
          onClick={() => setTab('monthly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'monthly'
              ? 'bg-white text-[#2DD4BF] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          월간
        </button>
        <button
          onClick={() => setTab('yearly')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'yearly'
              ? 'bg-white text-[#2DD4BF] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          연간
        </button>
      </div>

      {tab === 'monthly' ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 활동 추이</h3>
          {monthlyData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="exercise" stroke="#3b82f6" strokeWidth={2} name="운동" />
                  <Line type="monotone" dataKey="meal" stroke="#f97316" strokeWidth={2} name="식사" />
                  <Line type="monotone" dataKey="medication" stroke="#22c55e" strokeWidth={2} name="복약" />
                  <Line type="monotone" dataKey="sleep" stroke="#8b5cf6" strokeWidth={2} name="수면" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8 text-sm">아직 기록된 데이터가 없습니다.</p>
          )}
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">연도별 누적 통계</h3>
          {yearlyData.length > 0 ? (
            <div className="space-y-4">
              {yearlyData.map((y) => (
                <div
                  key={y.year}
                  className="p-4 rounded-xl border border-gray-200 bg-white"
                >
                  <h4 className="font-semibold text-gray-900 mb-3">{y.year}</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">운동</span>
                      <span className="font-medium text-blue-600">{y.totalExercise}일</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">식사</span>
                      <span className="font-medium text-orange-600">{y.totalMeal}일</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">복약</span>
                      <span className="font-medium text-green-600">{y.totalMedication}일</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">수면</span>
                      <span className="font-medium text-purple-600">{y.totalSleep}일</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8 text-sm">아직 기록된 데이터가 없습니다.</p>
          )}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-100">
        <MedicalDisclaimer variant="compact" />
      </div>
    </div>
  )
}
