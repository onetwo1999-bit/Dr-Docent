/**
 * 생년월일 기반 나이 계산 및 연령대별 건강 기준
 * 매년 날짜가 바뀔 때마다 나이가 자동 갱신되며, 이에 따라 건강 기준이 가변 적용됩니다.
 */

/** 생년월일 문자열 (YYYY-MM-DD) 또는 Date */
export function getAgeFromBirthDate(birthDate: string | Date | null | undefined): number | null {
  if (!birthDate) return null
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  if (age < 0 || age > 150) return null
  return age
}

/** 연령대 라벨 (건강 가이드·AI 컨텍스트용) */
export type AgeGroupKey = 'child' | 'teen' | 'twenties' | 'thirties' | 'forties' | 'fifties' | 'sixties' | 'seventy_plus'

export function getAgeGroup(age: number | null): AgeGroupKey | null {
  if (age === null || age < 0) return null
  if (age < 13) return 'child'
  if (age < 20) return 'teen'
  if (age < 30) return 'twenties'
  if (age < 40) return 'thirties'
  if (age < 50) return 'forties'
  if (age < 60) return 'fifties'
  if (age < 70) return 'sixties'
  return 'seventy_plus'
}

export const AGE_GROUP_LABELS: Record<AgeGroupKey, string> = {
  child: '소아',
  teen: '청소년',
  twenties: '20대',
  thirties: '30대',
  forties: '40대',
  fifties: '50대',
  sixties: '60대',
  seventy_plus: '70세 이상',
}

/** 연령대별 목표 심박수 (예: 운동 시 목표 구간, bpm) - 간이 기준 */
export function getTargetHeartRateRange(age: number | null): { min: number; max: number } | null {
  if (age === null || age < 10) return null
  const maxHR = Math.max(60, 220 - age)
  return {
    min: Math.round(maxHR * 0.5),
    max: Math.round(maxHR * 0.85),
  }
}

/** 연령대별 권장 일일 보행수 (걸음) - 간이 기준 */
export function getRecommendedDailySteps(age: number | null): number | null {
  if (age === null) return null
  const group = getAgeGroup(age)
  if (!group) return null
  const steps: Record<AgeGroupKey, number> = {
    child: 12_000,
    teen: 10_000,
    twenties: 10_000,
    thirties: 10_000,
    forties: 8_000,
    fifties: 8_000,
    sixties: 7_000,
    seventy_plus: 6_000,
  }
  return steps[group]
}

/** 연령대별 BMI 판정 보조 메시지 (예: 65세 이상은 과체중 기준 완화 등) */
export function getBMIGuidanceByAge(age: number | null, bmi: number): string | null {
  if (age === null) return null
  if (age >= 65 && bmi >= 23 && bmi < 25) {
    return '65세 이상에서는 23–25 구간이 권장될 수 있습니다.'
  }
  if (age >= 70 && bmi >= 22 && bmi < 26) {
    return '고령에서는 적정 BMI 범위가 다를 수 있어 전문의 상담을 권합니다.'
  }
  return null
}

/** 연령대별 건강 가이드 한 줄 (대시보드·프로필 표시용) */
export function getAgeGroupHealthGuide(age: number | null): string | null {
  if (age === null) return null
  const group = getAgeGroup(age)
  if (!group) return null
  const guides: Record<AgeGroupKey, string> = {
    child: '성장기에는 균형 잡힌 식사와 충분한 수면이 중요해요.',
    teen: '규칙적인 운동과 올바른 식습관으로 기초 체력을 쌓아보세요.',
    twenties: '지금 쌓는 생활 습관이 10년 후 건강을 좌우해요.',
    thirties: '스트레스 관리와 주기적인 건강검진을 권해드려요.',
    forties: '혈압·혈당 관리와 꾸준한 운동을 시작하기 좋은 시기예요.',
    fifties: '심혈관·골밀도 관리와 적정 체중 유지에 신경 써주세요.',
    sixties: '낙상 예방, 인지 활동, 정기 검진을 꾸준히 이어가세요.',
    seventy_plus: '일상 활동 유지와 약물 복용 관리에 조금 더 주의해 주세요.',
  }
  return guides[group]
}

/** AI 프롬프트용 연령 문구 (올해 OO세, 연령대 반영) */
export function getAgeContextForAI(age: number | null, birthDate: string | Date | null | undefined): string | null {
  if (age === null) return null
  const group = getAgeGroup(age)
  const label = group ? AGE_GROUP_LABELS[group] : `${age}세`
  return `올해 ${age}세(${label})이시므로, 연령에 맞는 건강 기준을 적용해 주세요.`
}
