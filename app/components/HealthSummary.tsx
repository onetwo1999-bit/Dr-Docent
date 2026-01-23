import { Activity, TrendingUp, AlertCircle, CheckCircle, Scale } from 'lucide-react'

interface Profile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

interface HealthSummaryProps {
  profile: Profile
  userName: string
}

// BMI 계산 함수 (글로벌 의료 기준)
function calculateBMI(height: number | null, weight: number | null): number | null {
  if (!height || !weight || height <= 0) return null
  const heightInMeters = height / 100
  return weight / (heightInMeters * heightInMeters)
}

// BMI 등급 판정 (글로벌 의료 기준 - WHO 기준)
function getBMICategory(bmi: number): {
  category: string
  color: string
  icon: typeof CheckCircle
  description: string
} {
  if (bmi < 18.5) {
    return {
      category: '저체중',
      color: 'text-blue-400',
      icon: AlertCircle,
      description: '건강한 체중 증가를 위해 균형 잡힌 식단을 권장드립니다.'
    }
  } else if (bmi < 23) {
    return {
      category: '정상',
      color: 'text-green-400',
      icon: CheckCircle,
      description: '건강한 체중을 유지하고 계십니다. 꾸준한 관리를 권장드립니다.'
    }
  } else if (bmi < 25) {
    return {
      category: '과체중',
      color: 'text-yellow-400',
      icon: TrendingUp,
      description: '적정 체중 관리를 위해 규칙적인 운동을 권장드립니다.'
    }
  } else if (bmi < 30) {
    return {
      category: '비만 (1단계)',
      color: 'text-orange-400',
      icon: AlertCircle,
      description: '체중 관리가 필요합니다. 전문가 상담을 권장드립니다.'
    }
  } else {
    return {
      category: '비만 (2단계 이상)',
      color: 'text-red-400',
      icon: AlertCircle,
      description: '건강 위험이 높습니다. 전문의 상담을 강력히 권장드립니다.'
    }
  }
}

// 나이별 건강 조언 (글로벌 의료 기준)
function getAgeAdvice(age: number | null, gender: string | null): string {
  if (!age) return ''
  
  if (age < 30) {
    return '활발한 신진대사를 유지하기 좋은 시기입니다. 건강한 습관을 형성하세요.'
  } else if (age < 40) {
    return '정기적인 건강검진을 시작하기 좋은 시기입니다.'
  } else if (age < 50) {
    return '심혈관 건강에 주의를 기울이시고, 연 1회 이상 건강검진을 권장드립니다.'
  } else if (age < 60) {
    return '골밀도와 혈당 관리에 신경 쓰시고, 정기적인 암 검진을 권장드립니다.'
  } else {
    return '규칙적인 건강검진과 적절한 운동으로 건강한 노년을 준비하세요.'
  }
}

export default function HealthSummary({ profile, userName }: HealthSummaryProps) {
  const bmi = calculateBMI(profile.height, profile.weight)
  const bmiInfo = bmi ? getBMICategory(bmi) : null
  const ageAdvice = getAgeAdvice(profile.age, profile.gender)

  if (!profile.height || !profile.weight) {
    return null
  }

  const BMIIcon = bmiInfo?.icon || Activity

  return (
    <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-[#40E0D0]" />
        <h3 className="font-semibold text-white">건강 분석 리포트</h3>
        <span className="text-xs text-white/40 ml-auto">글로벌 의료 기준</span>
      </div>

      {/* BMI 카드 */}
      {bmi && bmiInfo && (
        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/70">BMI 지수</span>
            </div>
            <div className="flex items-center gap-2">
              <BMIIcon className={`w-4 h-4 ${bmiInfo.color}`} />
              <span className={`font-bold ${bmiInfo.color}`}>{bmiInfo.category}</span>
            </div>
          </div>
          
          {/* BMI 수치 */}
          <div className="text-center my-3">
            <span className="text-4xl font-bold text-white">{bmi.toFixed(1)}</span>
            <span className="text-white/50 ml-1">kg/m²</span>
          </div>

          {/* BMI 게이지 바 */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <div 
              className="absolute h-full bg-gradient-to-r from-blue-400 via-green-400 via-yellow-400 to-red-400"
              style={{ width: '100%' }}
            />
            <div 
              className="absolute h-full w-1 bg-white shadow-lg"
              style={{ 
                left: `${Math.min(Math.max((bmi - 15) / 25 * 100, 0), 100)}%`,
                transform: 'translateX(-50%)'
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-white/40">
            <span>저체중</span>
            <span>정상</span>
            <span>과체중</span>
            <span>비만</span>
          </div>

          {/* BMI 설명 */}
          <p className="text-sm text-white/60 mt-3 leading-relaxed">
            {bmiInfo.description}
          </p>
        </div>
      )}

      {/* 신체 정보 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-xs text-white/50 mb-1">키</p>
          <p className="text-lg font-semibold text-white">{profile.height} <span className="text-sm text-white/60">cm</span></p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-xs text-white/50 mb-1">몸무게</p>
          <p className="text-lg font-semibold text-white">{profile.weight} <span className="text-sm text-white/60">kg</span></p>
        </div>
      </div>

      {/* 나이별 조언 */}
      {profile.age && ageAdvice && (
        <div className="bg-[#40E0D0]/10 rounded-lg p-3 mb-4">
          <p className="text-xs text-[#40E0D0] mb-1">
            {profile.age}세 {profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : ''}을 위한 조언
          </p>
          <p className="text-sm text-white/80">{ageAdvice}</p>
        </div>
      )}

      {/* 기저 질환 */}
      {profile.conditions && (
        <div className="bg-orange-500/10 rounded-lg p-3 mb-3">
          <p className="text-xs text-orange-400 mb-1">기저 질환</p>
          <p className="text-sm text-white/80">{profile.conditions}</p>
        </div>
      )}

      {/* 복용 약물 */}
      {profile.medications && (
        <div className="bg-purple-500/10 rounded-lg p-3">
          <p className="text-xs text-purple-400 mb-1">복용 중인 약물</p>
          <p className="text-sm text-white/80">{profile.medications}</p>
        </div>
      )}

      {/* 면책조항 */}
      <p className="text-xs text-white/30 mt-4 text-center leading-relaxed">
        본 분석은 글로벌 의료 기준(WHO)에 기반한 참고 정보이며,<br/>
        정확한 진단은 전문의와 상담하세요.
      </p>
    </div>
  )
}
