'use client'

import { useState, useEffect } from 'react'
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer,
  Tooltip
} from 'recharts'

interface Profile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

interface HealthRadarChartProps {
  profile: Profile
}

// ========================
// 🧮 건강 점수 계산 엔진
// ========================
function calculateHealthScores(profile: Profile): {
  cardiovascular: number
  musculoskeletal: number
  nutrition: number
  metabolism: number
  activity: number
  overall: number
} {
  const { age, height, weight, conditions } = profile
  
  // 기본 점수 (모두 80점에서 시작)
  let cardiovascular = 80  // 심혈관
  let musculoskeletal = 80 // 근골격
  let nutrition = 80       // 영양
  let metabolism = 80      // 대사
  let activity = 80        // 활동량
  
  // BMI 계산
  let bmi = 22 // 기본값
  if (height && weight && height > 0) {
    bmi = weight / Math.pow(height / 100, 2)
  }
  
  // 디버깅 로그 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 [HealthRadarChart] 건강 점수 계산 시작')
    console.log(`   - BMI: ${bmi.toFixed(1)}`)
    console.log(`   - 나이: ${age || '미입력'}`)
    console.log(`   - 기저질환: ${conditions || '없음'}`)
  }
  
  // ========================
  // 🫀 심혈관 점수
  // ========================
  if (conditions) {
    const conditionsLower = conditions.toLowerCase()
    if (conditionsLower.includes('고혈압')) cardiovascular -= 25
    if (conditionsLower.includes('심장') || conditionsLower.includes('심근')) cardiovascular -= 30
    if (conditionsLower.includes('부정맥')) cardiovascular -= 20
    if (conditionsLower.includes('고지혈') || conditionsLower.includes('콜레스테롤')) cardiovascular -= 15
  }
  
  // BMI가 높으면 심혈관 위험 증가
  if (bmi >= 30) cardiovascular -= 20
  else if (bmi >= 27) cardiovascular -= 12
  else if (bmi >= 25) cardiovascular -= 8
  
  // 나이에 따른 조정
  if (age && age >= 60) cardiovascular -= 10
  else if (age && age >= 50) cardiovascular -= 5
  
  // ========================
  // 🦴 근골격 점수
  // ========================
  if (conditions) {
    const conditionsLower = conditions.toLowerCase()
    if (conditionsLower.includes('관절') || conditionsLower.includes('관절염')) musculoskeletal -= 25
    if (conditionsLower.includes('허리') || conditionsLower.includes('디스크')) musculoskeletal -= 20
    if (conditionsLower.includes('골다공증')) musculoskeletal -= 25
    if (conditionsLower.includes('류마티스')) musculoskeletal -= 20
  }
  
  // 과체중이면 관절 부담 증가
  if (bmi >= 30) musculoskeletal -= 20
  else if (bmi >= 27) musculoskeletal -= 15
  else if (bmi >= 25) musculoskeletal -= 10
  
  // 나이에 따른 조정
  if (age && age >= 60) musculoskeletal -= 15
  else if (age && age >= 50) musculoskeletal -= 8
  
  // ========================
  // 🥗 영양 점수
  // ========================
  // 저체중이면 영양 부족 가능성
  if (bmi < 18.5) nutrition -= 20
  
  // 비만이면 과잉 섭취 가능성
  if (bmi >= 30) nutrition -= 15
  else if (bmi >= 25) nutrition -= 8
  
  // 당뇨가 있으면 식이 조절 필요
  if (conditions?.toLowerCase().includes('당뇨')) nutrition -= 10
  
  // ========================
  // 🔥 대사 점수
  // ========================
  // BMI에 따른 대사 점수
  if (bmi < 18.5) metabolism -= 15
  else if (bmi >= 30) metabolism -= 30
  else if (bmi >= 27) metabolism -= 20
  else if (bmi >= 25) metabolism -= 12
  else if (bmi >= 18.5 && bmi < 23) metabolism += 10 // 정상 범위면 보너스
  
  // 당뇨
  if (conditions?.toLowerCase().includes('당뇨')) metabolism -= 25
  
  // 갑상선
  if (conditions?.toLowerCase().includes('갑상선')) metabolism -= 15
  
  // 나이에 따른 대사 저하
  if (age && age >= 60) metabolism -= 15
  else if (age && age >= 50) metabolism -= 10
  else if (age && age >= 40) metabolism -= 5
  
  // ========================
  // 🏃 활동량 점수
  // ========================
  // 기본 점수는 중간값
  activity = 70
  
  // BMI 정상이면 활동적일 가능성
  if (bmi >= 18.5 && bmi < 23) activity += 15
  else if (bmi >= 25) activity -= 15
  else if (bmi >= 30) activity -= 25
  
  // 관절 문제가 있으면 활동 제한
  if (conditions) {
    const conditionsLower = conditions.toLowerCase()
    if (conditionsLower.includes('관절') || conditionsLower.includes('허리')) activity -= 15
  }
  
  // 나이에 따른 조정
  if (age && age >= 70) activity -= 20
  else if (age && age >= 60) activity -= 10
  
  // 모든 점수를 0-100 범위로 제한
  cardiovascular = Math.max(0, Math.min(100, cardiovascular))
  musculoskeletal = Math.max(0, Math.min(100, musculoskeletal))
  nutrition = Math.max(0, Math.min(100, nutrition))
  metabolism = Math.max(0, Math.min(100, metabolism))
  activity = Math.max(0, Math.min(100, activity))
  
  // 전체 점수 계산 (가중 평균)
  const overall = Math.round(
    (cardiovascular * 0.25 + 
     musculoskeletal * 0.2 + 
     nutrition * 0.2 + 
     metabolism * 0.2 + 
     activity * 0.15)
  )
  
  return {
    cardiovascular: Math.round(cardiovascular),
    musculoskeletal: Math.round(musculoskeletal),
    nutrition: Math.round(nutrition),
    metabolism: Math.round(metabolism),
    activity: Math.round(activity),
    overall
  }
}

// ========================
// 🎨 점수별 색상
// ========================
function getScoreColor(score: number): string {
  if (score >= 80) return '#4ade80' // green
  if (score >= 60) return '#facc15' // yellow
  if (score >= 40) return '#fb923c' // orange
  return '#f87171' // red
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return '😊'
  if (score >= 60) return '😐'
  if (score >= 40) return '😟'
  return '😰'
}

export default function HealthRadarChart({ profile }: HealthRadarChartProps) {
  // 🔒 SSR 안전 장치: 클라이언트에서만 렌더링
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  const scores = calculateHealthScores(profile)
  
  const data = [
    { subject: '심혈관', score: scores.cardiovascular, fullMark: 100 },
    { subject: '근골격', score: scores.musculoskeletal, fullMark: 100 },
    { subject: '영양', score: scores.nutrition, fullMark: 100 },
    { subject: '대사', score: scores.metabolism, fullMark: 100 },
    { subject: '활동량', score: scores.activity, fullMark: 100 },
  ]
  
  const overallColor = getScoreColor(scores.overall)
  const overallEmoji = getScoreEmoji(scores.overall)

  // SSR 중에는 로딩 표시
  if (!isClient) {
    return (
      <div className="relative h-[280px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-2">📊</div>
          <div className="text-white/60 text-sm">차트 로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* 레이더 차트 */}
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid 
            stroke="rgba(255,255,255,0.2)" 
            gridType="polygon"
          />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            tickCount={5}
          />
          <Radar
            name="건강 점수"
            dataKey="score"
            stroke="#40E0D0"
            fill="#40E0D0"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(0,80,80,0.95)', 
              border: '1px solid rgba(64,224,208,0.5)',
              borderRadius: '12px',
              color: 'white'
            }}
            formatter={(value: number) => [`${value}점`, '점수']}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      {/* 중앙 종합 점수 */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <div 
          className="text-4xl font-bold"
          style={{ color: overallColor }}
        >
          {scores.overall}
        </div>
        <div className="text-white/60 text-xs">종합점수</div>
        <div className="text-xl mt-1">{overallEmoji}</div>
      </div>
      
      {/* 점수 상세 (하단) */}
      <div className="grid grid-cols-5 gap-1 mt-4 text-center text-xs">
        {data.map((item) => (
          <div key={item.subject} className="space-y-1">
            <div 
              className="font-semibold"
              style={{ color: getScoreColor(item.score) }}
            >
              {item.score}
            </div>
            <div className="text-white/50 text-[10px]">{item.subject}</div>
          </div>
        ))}
      </div>
      
      {/* 디버그 정보 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-2 bg-black/30 rounded text-[10px] text-white/40">
          <div>BMI: {profile.height && profile.weight ? (profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1) : 'N/A'}</div>
          <div>프로필: {profile.height}cm / {profile.weight}kg / {profile.age}세</div>
          <div>기저질환: {profile.conditions || '없음'}</div>
        </div>
      )}
    </div>
  )
}
