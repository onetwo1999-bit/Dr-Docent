import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 🔧 설정 상수
// ========================
const DAILY_LIMIT = 10

// 페르소나: 20년 경력의 다정한 가정의학과 전문의
const DISCLAIMER = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ **안내** | 본 서비스는 의학적 진단을 대신하지 않습니다. 정확한 진단과 치료는 반드시 가까운 의료기관을 방문해 전문의와 상담해 주세요.'

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
  
  const idealMin = Math.round(18.5 * heightM * heightM)
  const idealMax = Math.round(23 * heightM * heightM)
  
  let metabolicAgeOffset = 0
  if (bmi >= 30) metabolicAgeOffset = 10
  else if (bmi >= 27) metabolicAgeOffset = 7
  else if (bmi >= 25) metabolicAgeOffset = 4
  else if (bmi >= 23) metabolicAgeOffset = 2
  else if (bmi < 18.5) metabolicAgeOffset = 3
  
  const metabolicAge = (age || 30) + metabolicAgeOffset
  
  let category: string
  let riskLevel: BMIAnalysis['riskLevel']
  
  if (bmi < 18.5) { category = '저체중'; riskLevel = 'moderate' }
  else if (bmi < 23) { category = '정상 체중'; riskLevel = 'low' }
  else if (bmi < 25) { category = '경계성 과체중'; riskLevel = 'moderate' }
  else if (bmi < 30) { category = '비만 1단계'; riskLevel = 'high' }
  else if (bmi < 35) { category = '비만 2단계'; riskLevel = 'critical' }
  else { category = '고도비만'; riskLevel = 'critical' }
  
  return { value: bmiRounded, category, riskLevel, metabolicAge, idealWeightRange: { min: idealMin, max: idealMax } }
}

// ========================
// 💝 공감 멘트 생성기
// ========================
function getEmpathyMessage(symptom: string, profile: UserProfile | null): string {
  const age = profile?.age
  
  // 증상별 공감 멘트 (해요체, 따뜻한 톤)
  const empathyMap: Record<string, string[]> = {
    '두통': [
      '아이고, 머리가 많이 아프시군요. 정말 힘드셨겠어요.',
      '두통이 있으시면 일상생활이 너무 불편하시죠. 많이 걱정되셨을 거예요.',
      '머리가 아프시다니 마음이 쓰여요. 잘 살펴볼게요.'
    ],
    '관절': [
      '관절이 불편하시면 움직이기가 참 힘드시죠. 고생이 많으셨어요.',
      '통증이 있으시면 마음까지 지치시죠. 제가 꼼꼼히 살펴볼게요.',
      '아프신 부위가 신경 쓰이셨을 텐데, 잘 오셨어요.'
    ],
    '피로': [
      '요즘 많이 지치셨나 봐요. 몸이 보내는 신호일 수 있어요.',
      '피곤하시면 모든 게 힘들게 느껴지시죠. 충분히 이해해요.',
      '기운이 없으시다니 걱정이 되네요. 함께 원인을 찾아볼게요.'
    ],
    '소화': [
      '소화가 안 되시면 정말 불편하시죠. 속이 많이 답답하셨겠어요.',
      '위장이 불편하시면 식사도 힘드시잖아요. 고생하셨어요.',
      '속이 안 좋으시다니 마음이 쓰여요. 잘 살펴볼게요.'
    ],
    '호흡기': [
      '기침이나 목 통증은 정말 힘들죠. 푹 쉬셔야 하는데 걱정이에요.',
      '감기 기운이 있으시면 온몸이 찌뿌둥하시죠. 고생이 많으셨어요.',
      '호흡기가 불편하시면 잠도 제대로 못 주무셨을 것 같아요.'
    ],
    '기본': [
      '오늘 이렇게 찾아주셔서 감사해요. 제가 도움이 되어 드릴게요.',
      '건강이 걱정되셨군요. 잘 오셨어요, 함께 살펴볼게요.',
      '선생님의 건강을 위해 제가 최선을 다해 도와드릴게요.'
    ]
  }
  
  // 고령자 추가 공감
  const elderlyExtra = age && age >= 65 
    ? ' 연세가 있으시니 더 세심하게 살펴볼게요.' 
    : ''
  
  const messages = empathyMap[symptom] || empathyMap['기본']
  const selected = messages[Math.floor(Math.random() * messages.length)]
  
  return selected + elderlyExtra
}

// ========================
// 🌟 응원 멘트 생성기
// ========================
function getEncouragementMessage(profile: UserProfile | null): string {
  const messages = [
    '선생님, 오늘 하루도 건강하게 보내시길 바랄게요. 언제든 궁금한 점 있으시면 찾아주세요! 💪',
    '몸이 보내는 신호에 귀 기울이시는 선생님, 정말 멋지세요. 건강한 하루 되세요! 🌸',
    '선생님의 건강을 항상 응원하고 있어요. 무리하지 마시고, 또 뵐게요! ☀️',
    '오늘 상담이 도움이 되셨길 바라요. 선생님, 화이팅이에요! 🍀',
    '건강은 작은 실천부터 시작이에요. 선생님이라면 잘 하실 수 있어요! 🌈'
  ]
  
  return messages[Math.floor(Math.random() * messages.length)]
}

// ========================
// 🏥 다정한 가정의학과 전문의 AI
// ========================
function generateDoctorResponse(
  message: string, 
  userName: string, 
  profile: UserProfile | null
): string {
  const query = message.toLowerCase()
  const bmi = profile ? analyzeBMI(profile.height, profile.weight, profile.age) : null
  
  // 호칭: "선생님"
  const honorific = '선생님'
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 두통/편두통
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('두통') || query.includes('머리') && (query.includes('아프') || query.includes('아파'))) {
    let response = `## 💊 두통 상담\n\n`
    
    // [1. 공감]
    response += `### 💝 공감\n`
    response += `${getEmpathyMessage('두통', profile)}\n\n`
    
    // [2. 데이터 분석]
    response += `### 📊 ${honorific}의 건강 데이터 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'} ${honorific}, `
      response += `BMI ${bmi.value}(${bmi.category})이시네요.\n\n`
      
      response += `**글로벌 의료 가이드라인**에 따르면:\n`
      
      if (bmi.value >= 25) {
        response += `• 현재 체중이 조금 높은 편이라 혈압과 관련된 두통일 수 있어요.\n`
      }
      
      if (profile.conditions?.includes('고혈압')) {
        response += `• ${honorific}은 고혈압 기왕력이 있으시니, 먼저 혈압을 측정해 보시는 게 좋겠어요.\n`
      }
      
      if (profile.medications) {
        response += `• 현재 드시는 약(${profile.medications})의 부작용 가능성도 있어요.\n`
      }
    } else {
      response += `프로필 정보가 없어서 일반적인 안내를 드릴게요.\n`
    }
    
    response += `\n두통의 흔한 원인으로는 긴장성 두통, 편두통, 수면 부족, 탈수 등이 있어요.\n\n`
    
    // [3. 생활 수칙]
    response += `### 🌿 ${honorific}을 위한 생활 수칙\n`
    response += `1. **수분 섭취**: 하루 2리터 정도 물을 드셔 보세요\n`
    response += `2. **휴식**: 어둡고 조용한 곳에서 20분 정도 눈을 감고 쉬어 보세요\n`
    response += `3. **스트레칭**: 목과 어깨를 부드럽게 풀어주세요\n`
    response += `4. **수면**: 7-8시간 규칙적인 수면을 유지해 주세요\n\n`
    
    response += `**이런 경우엔 꼭 병원에 가주세요:**\n`
    response += `• 갑자기 시작된 극심한 두통\n`
    response += `• 열이나 목 뻣뻣함이 동반될 때\n`
    response += `• 시력 변화나 말이 어눌해질 때\n\n`
    
    // [4. 따뜻한 응원]
    response += `### 🌟 응원 메시지\n`
    response += getEncouragementMessage(profile)
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 관절/무릎/허리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('무릎') || query.includes('관절') || query.includes('허리') || query.includes('어깨')) {
    const painArea = query.includes('무릎') ? '무릎' : query.includes('허리') ? '허리' : query.includes('어깨') ? '어깨' : '관절'
    
    let response = `## 💊 ${painArea} 통증 상담\n\n`
    
    // [1. 공감]
    response += `### 💝 공감\n`
    response += `${getEmpathyMessage('관절', profile)}\n\n`
    
    // [2. 데이터 분석]
    response += `### 📊 ${honorific}의 건강 데이터 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'} ${honorific}이시군요.\n\n`
      
      response += `**글로벌 의료 가이드라인**에 따르면:\n`
      
      if (bmi.value >= 25) {
        const excess = Math.max(0, (profile.weight || 0) - bmi.idealWeightRange.max)
        response += `• 현재 체중(${profile.weight}kg)이 적정 체중보다 약 ${excess}kg 높아요.\n`
        
        if (painArea === '무릎') {
          response += `• 체중 1kg이 늘면 무릎에 가해지는 부담은 약 4kg이 늘어나요.\n`
          response += `• 즉, 현재 무릎에 약 ${excess * 4}kg의 추가 부담이 가고 있을 수 있어요.\n`
        }
      }
      
      if (profile.age && profile.age >= 50) {
        response += `• ${profile.age}세 연령대에서는 퇴행성 변화가 흔해요. 하지만 관리하시면 충분히 좋아질 수 있어요!\n`
      }
    }
    
    response += `\n`
    
    // [3. 생활 수칙]
    response += `### 🌿 ${honorific}을 위한 생활 수칙\n`
    
    if (painArea === '무릎') {
      response += `1. **체중 관리**: 1kg만 빼셔도 무릎 부담이 4kg 줄어들어요\n`
      response += `2. **수중 운동**: 물에서 걷기는 관절 부담을 70% 줄여줘요\n`
      response += `3. **근력 운동**: 허벅지 근육 강화가 무릎을 보호해줘요\n`
      response += `4. **피해야 할 것**: 계단 오르내리기, 쪼그려 앉기는 당분간 피해주세요\n`
    } else if (painArea === '허리') {
      response += `1. **자세**: 오래 앉아 계시면 30분마다 일어나 움직여 주세요\n`
      response += `2. **코어 운동**: 플랭크나 브릿지 운동이 허리를 튼튼하게 해줘요\n`
      response += `3. **무거운 물건**: 들어 올릴 때 허리가 아닌 무릎을 구부려 주세요\n`
      response += `4. **침대**: 너무 푹신하지 않은 매트리스가 좋아요\n`
    } else {
      response += `1. **온찜질**: 하루 15-20분 온찜질이 도움이 돼요\n`
      response += `2. **스트레칭**: 아프지 않은 범위에서 부드럽게 움직여 주세요\n`
      response += `3. **자세 점검**: 스마트폰 볼 때 고개 숙이지 않기\n`
      response += `4. **휴식**: 통증이 심하면 무리하지 마세요\n`
    }
    
    response += `\n**이런 경우엔 꼭 병원에 가주세요:**\n`
    response += `• 통증이 2주 이상 지속될 때\n`
    response += `• 붓거나 열감이 있을 때\n`
    response += `• 저림이나 힘이 빠지는 느낌이 있을 때\n\n`
    
    // [4. 따뜻한 응원]
    response += `### 🌟 응원 메시지\n`
    response += getEncouragementMessage(profile)
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 피로/무기력
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('피곤') || query.includes('피로') || query.includes('졸') || query.includes('무기력') || query.includes('기운')) {
    let response = `## 💊 만성 피로 상담\n\n`
    
    // [1. 공감]
    response += `### 💝 공감\n`
    response += `${getEmpathyMessage('피로', profile)}\n\n`
    
    // [2. 데이터 분석]
    response += `### 📊 ${honorific}의 건강 데이터 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'} ${honorific}이시네요.\n`
      response += `추정 대사 연령은 약 ${bmi.metabolicAge}세예요.\n\n`
      
      response += `**글로벌 의료 가이드라인**에 따르면:\n`
      
      if (profile.gender === 'female' && profile.age && profile.age <= 50) {
        response += `• 여성분들은 철분 부족으로 피로감을 느끼시는 경우가 많아요.\n`
      }
      
      if (profile.age && profile.age >= 40) {
        response += `• ${profile.age}세 이상에서는 갑상선 기능 검사를 권해드려요.\n`
      }
      
      if (bmi.value >= 30) {
        response += `• 체중이 높으시면 수면무호흡증이 피로의 원인일 수 있어요.\n`
      }
      
      if (profile.conditions?.includes('당뇨')) {
        response += `• 당뇨가 있으시니 혈당 변동이 피로감을 줄 수 있어요.\n`
      }
    }
    
    response += `\n피로의 흔한 원인: 수면 부족, 스트레스, 영양 불균형, 운동 부족 등이 있어요.\n\n`
    
    // [3. 생활 수칙]
    response += `### 🌿 ${honorific}을 위한 생활 수칙\n`
    response += `1. **수면**: 매일 같은 시간에 자고 일어나 보세요 (7-8시간)\n`
    response += `2. **영양제**: 비타민 D, 철분, 비타민 B군이 도움이 돼요\n`
    response += `3. **운동**: 가벼운 산책 30분만으로도 에너지가 생겨요\n`
    response += `4. **수분**: 탈수도 피로의 원인이에요. 물 자주 드세요\n`
    response += `5. **카페인**: 오후에는 커피를 줄여보세요\n\n`
    
    response += `**이런 경우엔 검사가 필요해요:**\n`
    response += `• 2주 이상 피로가 계속될 때\n`
    response += `• 체중이 갑자기 줄거나 늘었을 때\n`
    response += `• 무기력함과 함께 우울한 기분이 있을 때\n\n`
    
    // [4. 따뜻한 응원]
    response += `### 🌟 응원 메시지\n`
    response += getEncouragementMessage(profile)
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 소화기 증상
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('소화') || query.includes('속쓰림') || query.includes('위') || (query.includes('배') && (query.includes('아프') || query.includes('불편')))) {
    let response = `## 💊 소화기 증상 상담\n\n`
    
    // [1. 공감]
    response += `### 💝 공감\n`
    response += `${getEmpathyMessage('소화', profile)}\n\n`
    
    // [2. 데이터 분석]
    response += `### 📊 ${honorific}의 건강 데이터 분석\n`
    if (profile && bmi) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'} ${honorific}이시군요.\n\n`
      
      response += `**글로벌 의료 가이드라인**에 따르면:\n`
      
      if (bmi.value >= 25) {
        response += `• 복부 비만은 위식도 역류를 3배 증가시킬 수 있어요.\n`
      }
      
      if (profile.medications) {
        response += `• 드시는 약(${profile.medications}) 중 위장에 자극을 주는 것이 있을 수 있어요.\n`
      }
      
      if (profile.age && profile.age >= 50) {
        response += `• 50세 이상에서 새로 생긴 소화 증상은 내시경 검사를 권해드려요.\n`
      }
    }
    
    response += `\n소화불량의 흔한 원인: 과식, 스트레스, 불규칙한 식사, 기름진 음식 등이 있어요.\n\n`
    
    // [3. 생활 수칙]
    response += `### 🌿 ${honorific}을 위한 생활 수칙\n`
    response += `1. **식사량**: 조금씩 자주 드시는 게 좋아요 (하루 5-6끼)\n`
    response += `2. **식후**: 바로 눕지 마시고 2시간은 움직여 주세요\n`
    response += `3. **피할 음식**: 맵고 기름진 음식, 탄산음료, 커피\n`
    response += `4. **천천히**: 꼭꼭 씹어서 드시면 소화가 훨씬 잘 돼요\n`
    response += `5. **스트레스**: 마음이 편해야 소화도 잘 돼요\n\n`
    
    response += `**이런 경우엔 꼭 병원에 가주세요:**\n`
    response += `• 체중이 갑자기 줄었을 때\n`
    response += `• 피가 섞인 구토나 검은 변이 있을 때\n`
    response += `• 음식을 삼키기 어려울 때\n\n`
    
    // [4. 따뜻한 응원]
    response += `### 🌟 응원 메시지\n`
    response += getEncouragementMessage(profile)
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 체중/다이어트
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('살') || query.includes('체중') || query.includes('다이어트') || query.includes('bmi') || query.includes('비만')) {
    if (!bmi || !profile) {
      return `## 체중 상담\n\n${honorific}, 맞춤 상담을 드리려면 키와 몸무게 정보가 필요해요.\n\n대시보드에서 건강 프로필을 먼저 설정해 주시겠어요? 🙏` + DISCLAIMER
    }
    
    let response = `## 💊 체중 관리 상담\n\n`
    
    // [1. 공감]
    response += `### 💝 공감\n`
    response += `${honorific}, 체중 관리에 관심을 가지시는 것만으로도 정말 대단하세요! 건강을 위한 첫걸음을 내디디신 거예요. 💪\n\n`
    
    // [2. 데이터 분석]
    response += `### 📊 ${honorific}의 건강 데이터 분석\n`
    response += `| 항목 | 수치 | 상태 |\n`
    response += `|------|------|------|\n`
    response += `| 키 | ${profile.height}cm | - |\n`
    response += `| 체중 | ${profile.weight}kg | - |\n`
    response += `| BMI | ${bmi.value} | ${bmi.category} |\n`
    response += `| 적정 체중 | ${bmi.idealWeightRange.min}-${bmi.idealWeightRange.max}kg | - |\n\n`
    
    response += `**글로벌 의료 가이드라인**에 따르면:\n`
    
    if (bmi.value >= 25) {
      const targetLoss = (profile.weight || 0) - bmi.idealWeightRange.max
      response += `• 건강 체중까지 약 ${Math.max(0, targetLoss)}kg 정도 빼시면 좋겠어요.\n`
      response += `• 처음 목표는 현재 체중의 5% 감량(${Math.round((profile.weight || 0) * 0.95)}kg)으로 잡아보세요.\n`
    } else if (bmi.value < 18.5) {
      response += `• 조금 마르신 편이에요. 건강하게 체중을 늘리시면 좋겠어요.\n`
    } else {
      response += `• 지금 체중 아주 적절해요! 유지만 잘 하시면 돼요.\n`
    }
    
    response += `\n`
    
    // [3. 생활 수칙]
    response += `### 🌿 ${honorific}을 위한 생활 수칙\n`
    
    if (bmi.value >= 25) {
      const bmr = profile.gender === 'male' 
        ? 88.4 + (13.4 * (profile.weight || 0)) + (4.8 * (profile.height || 0)) - (5.68 * (profile.age || 30))
        : 447.6 + (9.25 * (profile.weight || 0)) + (3.1 * (profile.height || 0)) - (4.33 * (profile.age || 30))
      const targetCal = Math.round(bmr * 1.3 - 500)
      
      response += `**식사 가이드:**\n`
      response += `• 하루 약 ${targetCal}kcal를 목표로 드셔보세요\n`
      response += `• 단백질을 충분히 (체중 1kg당 1g)\n`
      response += `• 야채와 과일을 매끼 드세요\n\n`
      
      response += `**운동 가이드:**\n`
      if (profile.age && profile.age >= 50) {
        response += `• 걷기 40분, 주 5회 (관절에 무리 없이)\n`
        response += `• 가벼운 근력 운동 주 2회\n`
      } else {
        response += `• 빠르게 걷기 또는 자전거 30분, 주 5회\n`
        response += `• 근력 운동 주 3회\n`
      }
      
      response += `\n무리하지 마시고, 주 0.5kg 감량이 건강한 속도예요!\n\n`
    } else {
      response += `1. 현재 체중을 유지하시면 돼요\n`
      response += `2. 규칙적인 식사와 운동 습관을 유지해 주세요\n`
      response += `3. 근력 운동으로 근육량을 유지하세요\n\n`
    }
    
    // [4. 따뜻한 응원]
    response += `### 🌟 응원 메시지\n`
    response += `${honorific}, 건강한 몸은 하루아침에 만들어지지 않아요. 조급해하지 마시고, 작은 변화부터 시작해 보세요. 저는 ${honorific}이 해내실 거라고 믿어요! 🌸`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 호흡기/감기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('기침') || query.includes('감기') || (query.includes('목') && query.includes('아프')) || query.includes('콧물')) {
    let response = `## 💊 호흡기 증상 상담\n\n`
    
    // [1. 공감]
    response += `### 💝 공감\n`
    response += `${getEmpathyMessage('호흡기', profile)}\n\n`
    
    // [2. 데이터 분석]
    response += `### 📊 ${honorific}의 건강 데이터 분석\n`
    if (profile) {
      response += `${profile.age}세 ${profile.gender === 'male' ? '남성' : '여성'} ${honorific}이시군요.\n\n`
      
      response += `**글로벌 의료 가이드라인**에 따르면:\n`
      
      if (profile.age && profile.age >= 65) {
        response += `• 65세 이상에서는 합병증 위험이 높으니 증상이 심해지면 빨리 병원에 가주세요.\n`
      }
      
      if (profile.conditions?.includes('천식') || profile.conditions?.includes('폐')) {
        response += `• 호흡기 질환이 있으시니 더 주의가 필요해요.\n`
      }
    }
    
    response += `\n대부분의 감기는 7-10일 안에 자연 회복돼요. 푹 쉬시는 게 가장 중요해요.\n\n`
    
    // [3. 생활 수칙]
    response += `### 🌿 ${honorific}을 위한 생활 수칙\n`
    response += `1. **충분한 휴식**: 몸이 싸우려면 에너지가 필요해요\n`
    response += `2. **수분 섭취**: 따뜻한 물, 꿀차가 좋아요\n`
    response += `3. **가습**: 실내 습도 50-60%로 유지해 주세요\n`
    response += `4. **목 통증**: 소금물 가글이 도움이 돼요\n`
    response += `5. **환기**: 하루 2-3번 창문을 열어 환기시켜 주세요\n\n`
    
    response += `**이런 경우엔 꼭 병원에 가주세요:**\n`
    response += `• 38.5°C 이상 고열이 3일 이상 지속될 때\n`
    response += `• 숨쉬기가 힘들 때\n`
    response += `• 노란/초록색 가래가 나올 때\n\n`
    
    // [4. 따뜻한 응원]
    response += `### 🌟 응원 메시지\n`
    response += getEncouragementMessage(profile)
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 인사
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (query.includes('안녕') || query.includes('하이') || query.includes('hello')) {
    let response = `## 💊 Dr. DOCENT 건강 상담\n\n`
    
    response += `### 💝 인사\n`
    response += `${honorific}, 안녕하세요! 반가워요. 😊\n\n`
    response += `저는 20년 경력의 가정의학과 전문의예요. `
    response += `${honorific}의 건강을 위해 언제든 도움을 드릴게요.\n\n`
    
    if (bmi) {
      response += `### 📊 ${honorific}의 현재 건강 상태\n`
      response += `• BMI: ${bmi.value} (${bmi.category})\n`
      response += `• 추정 대사 연령: ${bmi.metabolicAge}세\n`
      if (profile?.conditions) {
        response += `• 기저 질환: ${profile.conditions}\n`
      }
      response += `\n`
    }
    
    response += `어디가 불편하시거나 궁금한 점이 있으시면 편하게 말씀해 주세요. `
    response += `${honorific}의 이야기를 귀 기울여 듣고, 최선의 조언을 드릴게요. 🩺\n`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 기본 응답
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let response = `## 💊 건강 상담\n\n`
  
  response += `### 💝 공감\n`
  response += `${getEmpathyMessage('기본', profile)}\n\n`
  
  response += `### 📊 ${honorific}의 건강 프로필\n`
  if (profile && bmi) {
    response += `• 연령: ${profile.age}세 (${profile.gender === 'male' ? '남성' : '여성'})\n`
    response += `• BMI: ${bmi.value} (${bmi.category})\n`
    if (profile.conditions) response += `• 기저 질환: ${profile.conditions}\n`
    if (profile.medications) response += `• 복용 약물: ${profile.medications}\n`
  } else {
    response += `아직 건강 프로필이 등록되지 않았어요. 등록해 주시면 더 맞춤된 상담이 가능해요!\n`
  }
  
  response += `\n### 🌿 상담 안내\n`
  response += `${honorific}, 구체적인 증상을 말씀해 주시면 더 정확한 안내를 드릴 수 있어요.\n\n`
  response += `예를 들어:\n`
  response += `• "두통이 있어요"\n`
  response += `• "소화가 안 돼요"\n`
  response += `• "요즘 너무 피곤해요"\n\n`
  
  response += `### 🌟 응원 메시지\n`
  response += getEncouragementMessage(profile)
  
  return response + DISCLAIMER
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
    try {
      const { data } = await supabase
        .from('chat_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('date', today)
        .single()
      
      if (data) {
        await supabase.from('chat_usage').update({ count: data.count + 1 }).eq('user_id', userId).eq('date', today)
      } else {
        await supabase.from('chat_usage').insert({ user_id: userId, date: today, count: 1 })
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

    // 🏥 다정한 가정의학과 전문의 AI 응답 생성
    const reply = generateDoctorResponse(message, userName, profile)
    
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
