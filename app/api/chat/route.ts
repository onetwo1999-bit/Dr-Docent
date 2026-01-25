import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 🔧 설정 상수
// ========================
const DAILY_LIMIT = 10
const DISCLAIMER = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ **의료 고지** | 본 분석은 글로벌 의료 가이드라인에 기반한 참고 정보이며, 의학적 진단을 대신하지 않습니다. 정확한 진단과 치료는 반드시 전문의와 상담하십시오.'

// ========================
// 📊 유저 프로필 타입
// ========================
interface UserProfile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

// ========================
// 🧮 BMI 분석 엔진
// ========================
interface BMIAnalysis {
  value: number
  category: string
  riskLevel: 'low' | 'moderate' | 'high' | 'critical'
  metabolicAge: number
  idealWeightRange: { min: number; max: number }
}

function analyzeBMI(height: number | null, weight: number | null, age: number | null): BMIAnalysis | null {
  if (!height || !weight || height <= 0) return null
  
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  
  // 이상 체중 범위 (BMI 18.5-23 기준)
  const idealMin = Math.round(18.5 * heightM * heightM)
  const idealMax = Math.round(23 * heightM * heightM)
  
  // 대사 나이 추정 (BMI 기반)
  let metabolicAgeOffset = 0
  if (bmi >= 30) metabolicAgeOffset = 10
  else if (bmi >= 27) metabolicAgeOffset = 7
  else if (bmi >= 25) metabolicAgeOffset = 4
  else if (bmi >= 23) metabolicAgeOffset = 2
  else if (bmi < 18.5) metabolicAgeOffset = 3
  
  const metabolicAge = (age || 30) + metabolicAgeOffset
  
  let category: string
  let riskLevel: BMIAnalysis['riskLevel']
  
  if (bmi < 18.5) {
    category = '저체중'
    riskLevel = 'moderate'
  } else if (bmi < 23) {
    category = '정상 체중'
    riskLevel = 'low'
  } else if (bmi < 25) {
    category = '경계성 과체중'
    riskLevel = 'moderate'
  } else if (bmi < 30) {
    category = '비만 1단계'
    riskLevel = 'high'
  } else if (bmi < 35) {
    category = '비만 2단계'
    riskLevel = 'critical'
  } else {
    category = '고도비만'
    riskLevel = 'critical'
  }
  
  return {
    value: bmiRounded,
    category,
    riskLevel,
    metabolicAge,
    idealWeightRange: { min: idealMin, max: idealMax }
  }
}

// ========================
// 🏥 전문 의료 분석 AI 엔진
// ========================
function generateMedicalAnalysis(
  message: string, 
  userName: string, 
  profile: UserProfile | null
): string {
  const query = message.toLowerCase()
  const bmi = profile ? analyzeBMI(profile.height, profile.weight, profile.age) : null
  
  // 프로필 요약 생성
  const profileSummary = buildProfileSummary(profile, bmi)
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 두통/편두통 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('두통') || query.includes('머리') && (query.includes('아프') || query.includes('아파'))) {
    let response = `## 🩺 두통 증상 의학적 분석\n\n`
    
    // [현 상태 분석]
    response += `### 📊 현 상태 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'}, BMI ${bmi.value}(${bmi.category}). `
      
      if (bmi.value >= 25) {
        response += `현재 체질량지수가 과체중 범위로, 뇌혈관 관류압 증가와 연관된 긴장성 두통 발생 가능성이 상승합니다.\n\n`
      } else {
        response += `체질량지수는 정상 범위입니다.\n\n`
      }
    }
    
    // [의학적 원인 추정]
    response += `### 🔬 의학적 원인 추정\n`
    response += `글로벌 의료 가이드라인에 따른 두통 감별진단:\n\n`
    
    const causes: string[] = []
    
    if (profile?.conditions?.includes('고혈압')) {
      causes.push(`**⚠️ 고혈압 연관 두통** — 기왕력상 고혈압이 있으므로, 혈압 상승으로 인한 후두부 박동성 두통 가능성을 우선 배제해야 합니다. 즉시 혈압 측정을 권고합니다.`)
    }
    
    if (bmi && bmi.value >= 27) {
      causes.push(`**대사증후군 연관** — BMI ${bmi.value}는 인슐린 저항성 및 염증 마커 상승과 연관되어 만성 두통의 위험인자입니다.`)
    }
    
    if (profile?.age && profile.age >= 50) {
      causes.push(`**연령 관련 고려사항** — ${profile.age}세 이상에서 새로 발생한 두통은 측두동맥염 등 이차성 원인 감별이 필요합니다.`)
    }
    
    if (profile?.medications) {
      causes.push(`**약물 상호작용** — 현재 복용 중인 ${profile.medications}의 부작용으로 두통이 발생할 수 있습니다. 약물 복용 시점과 두통 발생 패턴의 상관관계를 확인하십시오.`)
    }
    
    if (causes.length === 0) {
      causes.push(`**일차성 두통** — 긴장형 두통 또는 편두통이 가장 흔한 원인입니다. 스트레스, 수면 부족, 카페인 과다 섭취 여부를 점검하십시오.`)
    }
    
    response += causes.map(c => `• ${c}`).join('\n\n')
    
    // [개인화된 생활 처방]
    response += `\n\n### 💊 개인화된 생활 처방\n`
    response += `**즉시 조치:**\n`
    response += `• 어두운 환경에서 20분간 휴식\n`
    response += `• 수분 500ml 섭취 (탈수 연관 두통 배제)\n`
    response += `• 경추 스트레칭 시행\n\n`
    
    response += `**48시간 내 권고:**\n`
    if (profile?.conditions?.includes('고혈압')) {
      response += `• 혈압 측정 후 140/90mmHg 이상 시 즉시 내원\n`
    }
    response += `• 두통 일지 작성 (발생 시각, 강도 1-10, 동반 증상)\n`
    response += `• 증상 지속 시 신경과 전문의 진료 예약\n`
    
    response += `\n**위험 징후 (즉시 응급실):**\n`
    response += `• 인생 최악의 두통 (벼락두통)\n`
    response += `• 발열 + 경부 강직 동반\n`
    response += `• 의식 변화 또는 신경학적 이상\n`
    
    return response + profileSummary + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 관절/무릎/허리 통증 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('무릎') || query.includes('관절') || query.includes('허리') || query.includes('어깨')) {
    const painArea = query.includes('무릎') ? '무릎' : query.includes('허리') ? '요추' : query.includes('어깨') ? '어깨' : '관절'
    
    let response = `## 🩺 ${painArea} 통증 의학적 분석\n\n`
    
    // [현 상태 분석]
    response += `### 📊 현 상태 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'}, BMI ${bmi.value}(${bmi.category}). `
      
      if (bmi.value >= 25) {
        const excessWeight = profile.weight! - bmi.idealWeightRange.max
        response += `**현 체중 ${profile.weight}kg은 이상 체중(${bmi.idealWeightRange.min}-${bmi.idealWeightRange.max}kg) 대비 약 ${excessWeight > 0 ? excessWeight : 0}kg 초과 상태**입니다. `
        
        if (painArea === '무릎') {
          response += `체중 1kg 증가 시 무릎 관절에 가해지는 부하는 약 4kg 증가하므로, 현재 추가 관절 부하는 약 ${(excessWeight > 0 ? excessWeight : 0) * 4}kg으로 추정됩니다.\n\n`
        } else if (painArea === '요추') {
          response += `비만은 요추 전만 증가 및 추간판 압력 상승의 주요 원인입니다.\n\n`
        }
      } else {
        response += `체중에 의한 역학적 과부하 가능성은 낮습니다.\n\n`
      }
    }
    
    // [의학적 원인 추정]
    response += `### 🔬 의학적 원인 추정\n`
    response += `글로벌 의료 가이드라인에 따른 ${painArea} 통증 감별:\n\n`
    
    if (profile?.age && profile.age >= 50) {
      response += `• **퇴행성 관절염** — ${profile.age}세 연령에서 가장 흔한 원인. 기상 시 30분 미만의 조조강직이 특징\n`
    }
    
    if (bmi && bmi.value >= 25) {
      response += `• **역학적 과부하** — BMI ${bmi.value}로 인한 관절면 압력 증가가 통증의 일차적 원인일 가능성\n`
    }
    
    if (profile?.conditions?.includes('당뇨')) {
      response += `• **당뇨성 관절병증** — 기왕력상 당뇨가 있어 결합조직 당화(glycation)로 인한 관절 강직 가능성 고려\n`
    }
    
    response += `• **근막동통증후군** — 주변 근육의 과긴장 및 trigger point에 의한 연관통\n`
    
    // [개인화된 생활 처방]
    response += `\n### 💊 개인화된 생활 처방\n`
    
    if (bmi && bmi.value >= 25) {
      response += `**체중 관리 (최우선):**\n`
      response += `• 목표 체중: ${bmi.idealWeightRange.max}kg (현재 대비 ${profile!.weight! - bmi.idealWeightRange.max}kg 감량)\n`
      response += `• 주당 0.5kg 감량 시 ${painArea} 부하 2kg 감소 효과\n\n`
    }
    
    response += `**운동 처방:**\n`
    if (painArea === '무릎') {
      response += `• 수중 걷기 30분 (부력으로 관절 부하 70% 감소)\n`
      response += `• 대퇴사두근 강화 운동 (등척성 수축)\n`
      response += `• 계단 오르기, 쪼그려 앉기 금지\n`
    } else if (painArea === '요추') {
      response += `• 맥켄지 신전 운동\n`
      response += `• 코어 안정화 운동 (플랭크, 브릿지)\n`
      response += `• 장시간 좌위 피하고 매 30분 기립\n`
    }
    
    response += `\n**진료 권고:**\n`
    response += `• 2주 이상 지속 시 X-ray 촬영\n`
    response += `• 야간통, 체중 감소 동반 시 즉시 내원\n`
    
    return response + profileSummary + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 피로/수면 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('피곤') || query.includes('피로') || query.includes('졸') || query.includes('무기력') || query.includes('기운')) {
    let response = `## 🩺 만성 피로 의학적 분석\n\n`
    
    // [현 상태 분석]
    response += `### 📊 현 상태 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'}, BMI ${bmi.value}(${bmi.category}). `
      response += `추정 대사 연령: **${bmi.metabolicAge}세** `
      
      if (bmi.metabolicAge > (profile.age || 30)) {
        response += `(실제 연령 대비 +${bmi.metabolicAge - (profile.age || 30)}세 — 대사 기능 저하 시사)\n\n`
      } else {
        response += `(양호)\n\n`
      }
    }
    
    // [의학적 원인 추정]
    response += `### 🔬 의학적 원인 추정\n`
    response += `글로벌 의료 가이드라인에 따른 만성 피로 감별진단:\n\n`
    
    if (profile?.gender === 'female' && profile.age && profile.age >= 12 && profile.age <= 50) {
      response += `• **철결핍성 빈혈** — 가임기 여성에서 가장 흔한 피로 원인. 혈청 페리틴 검사 권고\n`
    }
    
    if (profile?.age && profile.age >= 40) {
      response += `• **갑상선 기능 저하증** — ${profile.age}세 이상에서 TSH, Free T4 검사 필수\n`
    }
    
    if (bmi && bmi.value >= 30) {
      response += `• **폐쇄성 수면무호흡증** — BMI ${bmi.value}는 고위험군. 수면다원검사 고려\n`
    }
    
    if (profile?.conditions?.includes('당뇨')) {
      response += `• **혈당 변동** — 당뇨 기왕력으로 저혈당 또는 고혈당 에피소드 확인 필요\n`
    }
    
    response += `• **비타민 D 결핍** — 한국인 80% 이상에서 결핍. 25(OH)D 검사 권고\n`
    response += `• **우울증/번아웃** — 2주 이상 지속되는 피로는 정신건강 평가 고려\n`
    
    // [개인화된 생활 처방]
    response += `\n### 💊 개인화된 생활 처방\n`
    response += `**수면 위생:**\n`
    response += `• 취침/기상 시간 고정 (주말 포함)\n`
    response += `• 취침 2시간 전 스크린 차단\n`
    response += `• 침실 온도 18-20°C 유지\n\n`
    
    response += `**영양 보충:**\n`
    response += `• 비타민 D3 2000IU/일\n`
    response += `• 철분제 (생리 중인 여성의 경우)\n`
    response += `• 비타민 B군 복합제\n\n`
    
    response += `**검사 권고:**\n`
    response += `• CBC, 철/페리틴, TSH, 비타민 D, 공복혈당\n`
    response += `• 2주 이상 지속 시 내과 진료\n`
    
    return response + profileSummary + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 소화기 증상 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('소화') || query.includes('속쓰림') || query.includes('위') || query.includes('배') && (query.includes('아프') || query.includes('불편'))) {
    let response = `## 🩺 소화기 증상 의학적 분석\n\n`
    
    // [현 상태 분석]
    response += `### 📊 현 상태 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'}, BMI ${bmi.value}(${bmi.category}). `
      
      if (bmi.value >= 25) {
        response += `복부 비만은 위식도 역류(GERD) 발생률을 3배 증가시킵니다.\n\n`
      }
    }
    
    // [의학적 원인 추정]
    response += `### 🔬 의학적 원인 추정\n`
    response += `글로벌 의료 가이드라인에 따른 상부위장관 증상 감별:\n\n`
    
    response += `• **기능성 소화불량** — 가장 흔한 원인 (70%). H.pylori 감염 검사 권고\n`
    
    if (bmi && bmi.value >= 25) {
      response += `• **위식도역류질환** — BMI ${bmi.value}로 인한 복압 상승이 역류 유발\n`
    }
    
    if (profile?.age && profile.age >= 50) {
      response += `• **⚠️ 경고 징후 주의** — ${profile.age}세 이상 새로 발생한 소화기 증상은 내시경 검사 필요\n`
    }
    
    if (profile?.medications) {
      response += `• **약물 유발성** — ${profile.medications} 복용 중. NSAIDs, 아스피린 등은 위점막 손상 유발\n`
    }
    
    // [개인화된 생활 처방]
    response += `\n### 💊 개인화된 생활 처방\n`
    response += `**식이 요법:**\n`
    response += `• 소량 다회 식사 (1일 5-6회)\n`
    response += `• 식후 2시간 동안 눕지 않기\n`
    response += `• 취침 3시간 전 금식\n`
    response += `• 카페인, 알코올, 탄산음료 제한\n\n`
    
    if (bmi && bmi.value >= 25) {
      response += `**체중 관리:**\n`
      response += `• 5% 체중 감량 시 GERD 증상 40% 개선\n`
      response += `• 목표: ${Math.round(profile!.weight! * 0.95)}kg (현재 대비 -5%)\n\n`
    }
    
    response += `**진료 권고:**\n`
    response += `• 2주 이상 지속 시 내과 진료\n`
    response += `• 50세 이상: 위내시경 검사\n`
    response += `• 체중 감소, 연하곤란, 흑색변 시 즉시 내원\n`
    
    return response + profileSummary + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 체중/다이어트/BMI 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('살') || query.includes('체중') || query.includes('다이어트') || query.includes('bmi') || query.includes('비만')) {
    if (!bmi || !profile) {
      return `## 체중 분석 불가\n\n건강 프로필에 키/몸무게 정보가 없습니다.\n\n대시보드 → "건강 프로필 설정"에서 신체 정보를 입력해 주십시오.` + DISCLAIMER
    }
    
    let response = `## 🩺 체성분 및 대사 위험도 분석\n\n`
    
    // [현 상태 분석]
    response += `### 📊 현 상태 분석\n`
    response += `| 항목 | 측정값 | 판정 |\n`
    response += `|------|--------|------|\n`
    response += `| BMI | ${bmi.value} kg/m² | ${bmi.category} |\n`
    response += `| 현재 체중 | ${profile.weight}kg | - |\n`
    response += `| 이상 체중 | ${bmi.idealWeightRange.min}-${bmi.idealWeightRange.max}kg | - |\n`
    response += `| 추정 대사연령 | ${bmi.metabolicAge}세 | ${bmi.metabolicAge > (profile.age || 30) ? '⚠️ 주의' : '✅ 양호'} |\n\n`
    
    // [의학적 원인 추정 → 위험도 분석으로 변경]
    response += `### 🔬 대사 위험도 평가\n`
    response += `글로벌 의료 가이드라인 기준 동반 위험:\n\n`
    
    if (bmi.value >= 25) {
      response += `• **심혈관 질환** — 위험도 ${bmi.value >= 30 ? '고위험' : '중등도'} (BMI 25 이상 시 관상동맥질환 2배 ↑)\n`
      response += `• **제2형 당뇨** — BMI 1 증가당 당뇨 위험 12% ↑\n`
      response += `• **이상지질혈증** — 중성지방 상승, HDL 감소 경향\n`
    }
    
    if (bmi.value >= 30) {
      response += `• **수면무호흡증** — 고위험군 (선별 검사 권고)\n`
      response += `• **지방간** — 비알코올성 지방간 확률 80% 이상\n`
    }
    
    if (profile.conditions?.includes('고혈압') || profile.conditions?.includes('당뇨')) {
      response += `\n⚠️ **기존 질환과의 상승 작용**: ${profile.conditions} 기왕력으로 체중 관리 시급성 높음\n`
    }
    
    // [개인화된 생활 처방]
    response += `\n### 💊 개인화된 체중 관리 프로토콜\n`
    
    const targetWeight = bmi.idealWeightRange.max
    const weightToLose = profile.weight! - targetWeight
    
    if (weightToLose > 0) {
      response += `**목표 설정:**\n`
      response += `• 1차 목표: 현 체중의 5% 감량 → ${Math.round(profile.weight! * 0.95)}kg\n`
      response += `• 최종 목표: ${targetWeight}kg (${weightToLose}kg 감량)\n`
      response += `• 권장 속도: 주 0.5-1kg (${Math.ceil(weightToLose / 4)}-${Math.ceil(weightToLose / 2)}주 소요)\n\n`
    }
    
    response += `**열량 처방:**\n`
    const bmr = profile.gender === 'male' 
      ? 88.4 + (13.4 * profile.weight!) + (4.8 * profile.height!) - (5.68 * (profile.age || 30))
      : 447.6 + (9.25 * profile.weight!) + (3.1 * profile.height!) - (4.33 * (profile.age || 30))
    const tdee = Math.round(bmr * 1.3) // 가벼운 활동 기준
    const deficit = Math.round(tdee - 500)
    
    response += `• 추정 기초대사량: ${Math.round(bmr)} kcal\n`
    response += `• 일일 총 소비량(TDEE): ~${tdee} kcal\n`
    response += `• 감량용 섭취 권장: **${deficit} kcal/일** (-500 kcal 적자)\n\n`
    
    response += `**운동 처방:**\n`
    if (profile.age && profile.age >= 50) {
      response += `• 저강도 유산소: 걷기 40분, 주 5회\n`
      response += `• 저항 운동: 밴드 운동 주 2회\n`
    } else {
      response += `• 중강도 유산소: 빠르게 걷기/자전거 30분, 주 5회\n`
      response += `• 근력 운동: 주 3회 (대근육군 중심)\n`
    }
    
    return response + profileSummary + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 호흡기/감기 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('기침') || query.includes('감기') || query.includes('목') && query.includes('아프') || query.includes('콧물')) {
    let response = `## 🩺 호흡기 증상 의학적 분석\n\n`
    
    response += `### 📊 현 상태 분석\n`
    if (profile) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'}. `
      if (profile.age && profile.age >= 65) {
        response += `**⚠️ 고령으로 호흡기 감염 합병증 고위험군**입니다.\n\n`
      } else {
        response += `일반적인 면역 상태로 추정됩니다.\n\n`
      }
    }
    
    response += `### 🔬 의학적 원인 추정\n`
    response += `• **급성 상기도 감염(감기)** — 가장 흔한 원인. 대부분 7-10일 내 자연 회복\n`
    response += `• **알레르기성 비염** — 맑은 콧물, 재채기, 눈 가려움 동반 시\n`
    response += `• **급성 인두염** — 인후통 주 증상 시. A군 연쇄상구균 감별 필요\n\n`
    
    if (profile?.conditions?.includes('천식') || profile?.conditions?.includes('폐')) {
      response += `⚠️ **호흡기 기왕력 주의**: ${profile.conditions} — 증상 악화 시 즉시 진료 필요\n\n`
    }
    
    response += `### 💊 개인화된 생활 처방\n`
    response += `**대증 요법:**\n`
    response += `• 충분한 수분 (하루 2L 이상)\n`
    response += `• 가습기 사용 (습도 50-60%)\n`
    response += `• 인후통 시 따뜻한 소금물 가글\n\n`
    
    response += `**진료 필요 시점:**\n`
    response += `• 38.5°C 이상 고열 3일 이상\n`
    response += `• 화농성(노란/초록) 가래\n`
    response += `• 호흡 곤란 또는 흉통\n`
    response += `• 증상 10일 이상 지속\n`
    
    return response + profileSummary + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 인사 (간결하게)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('안녕') || query.includes('하이') || query.includes('hello')) {
    let response = `${userName}님, 반갑습니다.\n\n`
    response += `**Dr. DOCENT** — 글로벌 의료 가이드라인 기반 AI 건강 분석 서비스입니다.\n\n`
    
    if (bmi) {
      response += `📊 현재 분석 가능 상태:\n`
      response += `• BMI ${bmi.value} (${bmi.category})\n`
      response += `• 추정 대사연령 ${bmi.metabolicAge}세\n`
      if (profile?.conditions) {
        response += `• 기저질환 연동: ${profile.conditions}\n`
      }
    } else {
      response += `💡 건강 프로필 입력 시 맞춤형 분석이 가능합니다.\n`
    }
    
    response += `\n증상이나 건강 관련 궁금한 점을 말씀해 주십시오.`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 기본 응답 (예시 질문 제거, 분석 집중)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let response = `## 🩺 건강 상담 분석\n\n`
  
  response += `### 📊 현 상태 분석\n`
  if (profile && bmi) {
    response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'}, BMI ${bmi.value}(${bmi.category}), 대사연령 ${bmi.metabolicAge}세.\n`
    if (profile.conditions) {
      response += `기저 질환: ${profile.conditions}\n`
    }
    if (profile.medications) {
      response += `복용 약물: ${profile.medications}\n`
    }
  } else {
    response += `건강 프로필 미등록 상태입니다. 프로필 입력 시 정밀 분석이 가능합니다.\n`
  }
  
  response += `\n### 💬 상담 안내\n`
  response += `구체적인 증상(부위, 양상, 기간, 동반 증상)을 말씀해 주시면 글로벌 의료 가이드라인에 기반한 정밀 분석을 제공해 드리겠습니다.\n`
  
  return response + profileSummary + DISCLAIMER
}

// ========================
// 📋 프로필 요약 빌더
// ========================
function buildProfileSummary(profile: UserProfile | null, bmi: BMIAnalysis | null): string {
  if (!profile || (!bmi && !profile.conditions)) return ''
  
  let summary = '\n\n━━━━━━━━━━━━━━━━━━━━\n'
  summary += `📋 **분석 기반 데이터**\n`
  
  if (profile.age) summary += `• 연령: ${profile.age}세\n`
  if (profile.gender) summary += `• 성별: ${profile.gender === 'male' ? '남성' : '여성'}\n`
  if (profile.height && profile.weight) summary += `• 신체: ${profile.height}cm / ${profile.weight}kg\n`
  if (bmi) summary += `• BMI: ${bmi.value} (${bmi.category})\n`
  if (profile.conditions) summary += `• 기저 질환: ${profile.conditions}\n`
  if (profile.medications) summary += `• 복용 약물: ${profile.medications}\n`
  
  return summary
}

// ========================
// 🔢 일일 사용량 체크
// ========================
async function checkDailyLimit(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('chat_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    return { allowed: true, count: 0 }
  }
  
  const currentCount = data?.count || 0
  return { allowed: currentCount < DAILY_LIMIT, count: currentCount }
}

// ========================
// 📈 사용량 증가
// ========================
async function incrementUsage(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  
  try {
    await supabase.rpc('increment_chat_usage', { p_user_id: userId })
  } catch {
    // 함수가 없으면 직접 upsert
    try {
      const { data } = await supabase
        .from('chat_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('date', today)
        .single()
      
      if (data) {
        await supabase
          .from('chat_usage')
          .update({ count: data.count + 1 })
          .eq('user_id', userId)
          .eq('date', today)
      } else {
        await supabase
          .from('chat_usage')
          .insert({ user_id: userId, date: today, count: 1 })
      }
    } catch {
      // 테이블 없으면 무시
    }
  }
}

// ========================
// 🚀 메인 API 핸들러
// ========================
export async function POST(req: Request) {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON 형식 오류' }, { status: 400 })
    }
    
    const { message } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const { allowed, count } = await checkDailyLimit(supabase, user.id)
    
    if (!allowed) {
      return NextResponse.json({
        error: `일일 사용 제한(${DAILY_LIMIT}회)을 초과했습니다.`,
        dailyLimit: true,
        count
      }, { status: 429 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('age, gender, height, weight, conditions, medications')
      .eq('id', user.id)
      .single()

    const userName = 
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] || 
      '회원'

    const reply = generateMedicalAnalysis(message, userName, profile)
    
    incrementUsage(supabase, user.id).catch(() => {})
    
    return NextResponse.json({ 
      reply,
      usage: { count: count + 1, limit: DAILY_LIMIT, remaining: DAILY_LIMIT - count - 1 }
    })
    
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
