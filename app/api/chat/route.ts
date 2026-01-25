import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 🔧 설정 상수
// ========================
const DAILY_LIMIT = 10
const DISCLAIMER = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ 본 서비스는 의학적 진단을 대신하지 않습니다. 정확한 진단은 전문의와 상담해 주세요.'

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
// 🔍 유연한 키워드 매칭 (부분 일치)
// ========================
function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some(keyword => text.includes(keyword))
}

function findMatching(text: string, keywords: string[]): string[] {
  return keywords.filter(keyword => text.includes(keyword))
}

// ========================
// 🔍 키워드 추출기 (확장)
// ========================
function extractKeywords(message: string): string[] {
  const keywords: string[] = []
  
  // 치료/시술 관련 (확장)
  const treatments = ['충격파', '침', '물리치료', '주사', '약', '수술', '도수치료', '운동치료', 
    '스트레칭', '찜질', '파스', '진통제', '마사지', '정형외과', '한의원', '재활', '치료', '병원']
  findMatching(message, treatments).forEach(t => keywords.push(t))
  
  // 증상 관련 (확장)
  const symptoms = ['아프', '아파', '통증', '시큰', '쑤시', '저리', '붓', '뻣뻣', '찌릿', 
    '욱신', '뜨끔', '결리', '당기', '무거', '피곤', '어지러', '두근', '쓰리', '시리', '아리']
  findMatching(message, symptoms).forEach(s => keywords.push(s))
  
  // 상황/활동 관련 (확장)
  const activities = ['계단', '앉', '일어', '걸', '뛰', '운동', '아르바이트', '알바', '일하', 
    '오래 서', '오래 앉', '출퇴근', '잠', '아침', '저녁', '밤', '내려', '올라', '구부리', '펴']
  findMatching(message, activities).forEach(a => keywords.push(a))
  
  // 신체 부위 (확장)
  const bodyParts = ['무릎', '허리', '어깨', '목', '발목', '손목', '팔', '다리', '등', '골반', 
    '엉덩이', '종아리', '허벅지', '발', '손', '관절']
  findMatching(message, bodyParts).forEach(b => keywords.push(b))
  
  return [...new Set(keywords)]
}

// ========================
// 🧠 대화 컨텍스트 분석기 (개선)
// ========================
function analyzeContext(message: string): {
  isFollowUp: boolean
  hasTreatmentHistory: boolean
  hasNoImprovement: boolean
  hasLifestyleFactor: boolean
  hasPainPattern: boolean
  mainTopic: string | null
  keywords: string[]
  bodyPart: string | null
} {
  const keywords = extractKeywords(message)
  
  // 치료 경험/후속 대화 감지 (확장)
  const treatmentIndicators = ['받', '했는데', '해봤', '먹', '다녀', '갔', '치료', '병원', '의원']
  const isFollowUp = containsAny(message, treatmentIndicators)
  
  // 호전 없음 감지 (확장 - 더 유연하게)
  const noImprovementIndicators = ['낫지', '나아지', '호전', '똑같', '여전히', '계속', 
    '효과', '소용', '안 낫', '안낫', '않아', '없어', '그대로', '변화가 없', '마찬가지']
  const hasNoImprovement = containsAny(message, noImprovementIndicators) && 
    (containsAny(message, ['않', '없', '안']) || message.includes('그대로'))
  
  // 생활 습관/직업 요인 감지
  const lifestyleIndicators = ['아르바이트', '알바', '일하', '직장', '회사', '서서', '앉아서', 
    '무거운', '반복', '오래', '매일', '항상']
  const hasLifestyleFactor = containsAny(message, lifestyleIndicators)
  
  // 통증 패턴 감지 (계단, 특정 동작 등)
  const painPatternIndicators = ['계단', '내려', '올라', '앉을', '일어', '구부', '펼', '돌리', 
    '들', '잡', '~할 때', '하면']
  const hasPainPattern = containsAny(message, painPatternIndicators)
  
  // 신체 부위 감지
  let bodyPart: string | null = null
  if (containsAny(message, ['무릎', '슬관절'])) bodyPart = '무릎'
  else if (containsAny(message, ['허리', '요추', '척추'])) bodyPart = '허리'
  else if (containsAny(message, ['어깨', '견관절'])) bodyPart = '어깨'
  else if (containsAny(message, ['목', '경추'])) bodyPart = '목'
  else if (containsAny(message, ['발목'])) bodyPart = '발목'
  else if (containsAny(message, ['손목'])) bodyPart = '손목'
  
  // 계단 + 통증 = 무릎 추정
  if (!bodyPart && containsAny(message, ['계단']) && containsAny(message, ['아프', '아파', '통증', '심해'])) {
    bodyPart = '무릎'
  }
  
  // 주요 토픽 결정
  let mainTopic: string | null = null
  if (bodyPart === '무릎' || containsAny(message, ['관절'])) mainTopic = '무릎/관절'
  else if (bodyPart === '허리') mainTopic = '허리'
  else if (bodyPart === '어깨' || bodyPart === '목') mainTopic = '어깨/목'
  else if (containsAny(message, ['두통', '머리 아', '머리가 아'])) mainTopic = '두통'
  else if (containsAny(message, ['소화', '위', '속 쓰림', '속쓰림', '체'])) mainTopic = '소화기'
  else if (containsAny(message, ['피로', '피곤', '기운', '무기력', '지쳐'])) mainTopic = '피로'
  else if (containsAny(message, ['통증', '아프', '아파']) && hasPainPattern) mainTopic = '통증'
  
  return {
    isFollowUp,
    hasTreatmentHistory: isFollowUp,
    hasNoImprovement,
    hasLifestyleFactor,
    hasPainPattern,
    mainTopic,
    keywords,
    bodyPart
  }
}

// ========================
// 💬 동적 심화 질문 생성기
// ========================
function generateFollowUpQuestion(context: ReturnType<typeof analyzeContext>): string {
  const { mainTopic, bodyPart, hasPainPattern, hasNoImprovement } = context
  
  // 호전 없음인 경우
  if (hasNoImprovement) {
    const questions = [
      '치료를 얼마나 오래 받으셨어요?',
      '통증이 시작된 지는 얼마나 되셨어요?',
      '일상에서 같은 동작을 반복하시는 일이 있으세요?',
      '쉴 때는 통증이 좀 나아지시나요?'
    ]
    return questions[Math.floor(Math.random() * questions.length)]
  }
  
  // 통증 패턴이 있는 경우
  if (hasPainPattern && (bodyPart === '무릎' || mainTopic === '무릎/관절')) {
    const questions = [
      '올라갈 때와 내려갈 때 중 언제 더 아프세요?',
      '앉았다 일어날 때도 불편하신가요?',
      '아침에 일어났을 때 무릎이 뻣뻣한 느낌이 있으세요?',
      '무릎에서 소리가 나기도 하나요?'
    ]
    return questions[Math.floor(Math.random() * questions.length)]
  }
  
  // 부위별 질문
  if (bodyPart === '무릎' || mainTopic === '무릎/관절') {
    return '계단을 오르내리실 때 통증이 심해지시나요?'
  }
  if (bodyPart === '허리' || mainTopic === '허리') {
    return '앉아 있다가 일어날 때 허리가 뻣뻣하신가요?'
  }
  if (bodyPart === '어깨' || bodyPart === '목' || mainTopic === '어깨/목') {
    return '팔을 위로 올릴 때 통증이 있으세요?'
  }
  
  return '증상이 시작된 게 언제쯤인지 기억나세요?'
}

// ========================
// 🧮 BMI 분석
// ========================
function analyzeBMI(height: number | null, weight: number | null, age: number | null) {
  if (!height || !weight || height <= 0) return null
  
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  const idealMax = Math.round(23 * heightM * heightM)
  const excess = Math.max(0, weight - idealMax)
  
  let category = '정상'
  if (bmi < 18.5) category = '저체중'
  else if (bmi < 23) category = '정상'
  else if (bmi < 25) category = '과체중'
  else if (bmi < 30) category = '비만 1단계'
  else category = '비만 2단계'
  
  return { value: bmiRounded, category, excess, idealMax }
}

// ========================
// 🏥 동적 대화형 AI 응답 생성 (개선)
// ========================
function generateDynamicResponse(
  message: string, 
  userName: string, 
  profile: UserProfile | null
): string {
  const context = analyzeContext(message)
  const bmi = profile ? analyzeBMI(profile.height, profile.weight, profile.age) : null
  const honorific = '선생님'
  
  console.log('🔍 [AI] 컨텍스트 분석:', JSON.stringify(context, null, 2))
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 치료 후 호전 없음 (최우선 처리)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.hasNoImprovement || (context.isFollowUp && containsAny(message, ['않', '없', '안']))) {
    const bodyPartText = context.bodyPart || '해당 부위'
    const mentionedKeywords = context.keywords.slice(0, 3)
    
    let response = `${honorific}, `
    
    // 키워드 인용
    if (mentionedKeywords.length > 0) {
      response += `**${mentionedKeywords.join(', ')}** 관련해서 `
    }
    response += `치료를 받으셨는데도 나아지지 않으셨군요. 정말 답답하셨겠어요. 😔\n\n`
    
    // 통증 패턴 분석
    if (context.hasPainPattern) {
      const patterns = context.keywords.filter(k => ['계단', '내려', '올라', '앉', '일어'].includes(k))
      if (patterns.length > 0) {
        response += `**"${patterns.join(', ')}"** 동작에서 통증이 심해지신다고 하셨는데, `
        
        if (containsAny(message, ['계단', '내려'])) {
          response += `계단을 내려갈 때 더 아프시다면 **슬개대퇴 관절(무릎뼈-허벅지뼈 사이)** 문제일 가능성이 높아요.\n\n`
        } else {
          response += `이런 특정 동작에서 악화되는 패턴은 원인을 찾는 중요한 단서예요.\n\n`
        }
      }
    }
    
    response += `### 🔬 글로벌 의료 가이드라인에 따른 새로운 분석\n\n`
    
    response += `치료에도 호전이 없다면 다음을 살펴봐야 해요:\n\n`
    
    response += `**1. 만성화 가능성**\n`
    response += `통증이 3개월 이상 지속되면 **만성 통증**으로 분류돼요. `
    response += `이 경우 단순 국소 치료만으로는 한계가 있고, **신경계 과민화** 치료가 필요할 수 있어요.\n\n`
    
    response += `**2. 근본 원인 미해결**\n`
    response += `치료를 받아도 **통증을 유발하는 원인(자세, 동작, 체중 부하)**이 그대로라면 계속 재발할 수 있어요.\n`
    
    if (bmi && bmi.value >= 25 && (context.bodyPart === '무릎' || context.mainTopic?.includes('무릎'))) {
      response += `• ${honorific}의 경우 체중 ${bmi.excess}kg만 줄이셔도 ${context.bodyPart || '관절'} 부담이 **${bmi.excess * 4}kg** 줄어들어요.\n`
    }
    
    response += `\n**3. 진단 재평가 필요성**\n`
    response += `처음 진단이 정확했는지, 다른 원인은 없는지 다시 확인이 필요할 수 있어요.\n\n`
    
    response += `### 💡 제안\n`
    response += `• 통증 일지 작성 (언제, 어떤 동작 후 악화되는지)\n`
    response += `• 현재 치료 의사에게 "호전이 없다"고 솔직히 말씀하세요\n`
    response += `• 필요시 다른 전문의 의견(세컨드 오피니언)도 도움이 돼요\n\n`
    
    response += `---\n🤔 ${generateFollowUpQuestion(context)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 통증 + 동작 패턴 (계단, 앉기 등)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.hasPainPattern && containsAny(message, ['아프', '아파', '통증', '심해'])) {
    const bodyPartText = context.bodyPart || '해당 부위'
    const patterns = context.keywords.filter(k => ['계단', '내려', '올라', '앉', '일어', '구부'].includes(k))
    
    let response = `${honorific}, `
    
    if (patterns.length > 0) {
      response += `**${patterns.join(', ')}** 동작에서 통증이 심해지시는군요. 많이 불편하셨겠어요. 😔\n\n`
    } else {
      response += `통증이 있으시군요. 힘드셨겠어요. 😔\n\n`
    }
    
    // 계단 + 통증 = 무릎 분석
    if (containsAny(message, ['계단'])) {
      response += `**계단에서 악화되는 통증**은 무릎 문제를 시사해요:\n\n`
      response += `• **내려갈 때 더 아프면**: 슬개대퇴 관절(무릎뼈) 문제 가능성\n`
      response += `• **올라갈 때 더 아프면**: 대퇴사두근(허벅지 앞쪽) 약화 가능성\n`
      response += `• **양쪽 다 아프면**: 퇴행성 관절염 또는 연골 손상 가능성\n\n`
    }
    
    // BMI 연관 (짧게)
    if (bmi && bmi.value >= 25) {
      response += `💡 참고: 현재 체중에서 ${bmi.excess}kg만 줄이셔도 무릎 부담이 **${bmi.excess * 4}kg** 감소해요.\n\n`
    }
    
    // 치료 받고 있다면
    if (context.isFollowUp) {
      response += `치료를 받고 계신다고 하셨는데, 효과는 어떠세요?\n\n`
    }
    
    response += `---\n🤔 ${generateFollowUpQuestion(context)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 치료 경험 언급 (일반 후속)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.isFollowUp && context.keywords.length > 0) {
    const treatments = context.keywords.filter(k => 
      ['충격파', '침', '물리치료', '주사', '도수치료', '치료', '병원', '한의원', '정형외과'].includes(k)
    )
    
    let response = `${honorific}, `
    
    if (treatments.length > 0) {
      response += `**${treatments.join(', ')}**를 받고 계시는군요!\n\n`
      
      if (treatments.includes('충격파')) {
        response += `충격파 치료는 힘줄/인대 회복을 촉진해요. 보통 3-5회 정도 받으시면 효과를 느끼실 수 있어요.\n\n`
      }
      if (treatments.includes('침') || treatments.includes('한의원')) {
        response += `침 치료는 근육 이완과 혈액순환에 도움이 돼요.\n\n`
      }
      if (treatments.includes('물리치료')) {
        response += `물리치료는 꾸준함이 중요해요. 집에서도 알려주신 운동을 해주시면 효과가 배가 돼요.\n\n`
      }
    } else {
      response += `치료를 받고 계시는군요.\n\n`
    }
    
    response += `효과는 어떠세요? 조금이라도 나아지고 계신가요?\n\n`
    response += `---\n🤔 ${generateFollowUpQuestion(context)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 무릎/관절 (첫 상담)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '무릎/관절' || context.bodyPart === '무릎') {
    let response = `${honorific}, 무릎이 불편하시군요. 많이 신경 쓰이셨겠어요. 😔\n\n`
    
    if (context.keywords.some(k => ['시큰', '쑤시', '욱신'].includes(k))) {
      response += `**"${context.keywords.filter(k => ['시큰', '쑤시', '욱신'].includes(k)).join(', ')}"** 느낌은 관절 주변 염증이나 퇴행성 변화를 시사할 수 있어요.\n\n`
    }
    
    if (bmi && bmi.value >= 25) {
      response += `💡 ${honorific}의 경우 체중 ${bmi.excess}kg만 줄이셔도 무릎 부담이 **${bmi.excess * 4}kg** 줄어들어요.\n\n`
    }
    
    if (profile?.age && profile.age >= 50) {
      response += `${profile.age}세 연령대에서는 퇴행성 관절염이 흔하지만, 관리하시면 충분히 좋아질 수 있어요!\n\n`
    }
    
    response += `---\n🤔 ${generateFollowUpQuestion(context)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 허리
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '허리' || context.bodyPart === '허리') {
    let response = `${honorific}, 허리가 불편하시군요. 일상이 힘드셨겠어요. 😔\n\n`
    
    if (containsAny(message, ['저리', '찌릿', '다리'])) {
      response += `**다리로 저린 느낌**이 있으시다면 디스크 문제일 수 있어요. 신경이 눌리면서 생기는 증상이에요.\n\n`
    }
    
    if (context.hasLifestyleFactor) {
      const factors = context.keywords.filter(k => ['오래', '앉', '서', '일'].includes(k))
      response += `말씀하신 **${factors.join(', ')}** 상황이 허리에 부담을 주고 있을 수 있어요.\n\n`
    }
    
    response += `---\n🤔 ${generateFollowUpQuestion(context)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 두통
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '두통') {
    let response = `${honorific}, 머리가 아프시군요. 정말 힘드셨겠어요. 😔\n\n`
    
    if (profile?.conditions?.includes('고혈압')) {
      response += `⚠️ ${honorific}은 고혈압 기왕력이 있으시니, 혈압을 한번 체크해 보시는 게 좋겠어요.\n\n`
    }
    
    response += `---\n🤔 두통이 있을 때 빛이나 소리에 민감해지시나요?`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 피로
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '피로') {
    let response = `${honorific}, 요즘 많이 지치셨나 봐요. 몸이 보내는 신호일 수 있어요. 😔\n\n`
    
    if (profile?.age && profile.age >= 40) {
      response += `${profile.age}세 이상에서는 갑상선 기능 검사를 한번 받아보시는 것도 좋아요.\n\n`
    }
    
    response += `---\n🤔 아침에 일어났을 때도 피곤하신가요?`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 인사
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (containsAny(message.toLowerCase(), ['안녕', '하이', 'hello', '반가'])) {
    let response = `${honorific}, 안녕하세요! 반가워요. 😊\n\n`
    response += `저는 20년 경력의 가정의학과 전문의예요. `
    response += `${honorific}의 건강 고민을 편하게 말씀해 주시면, 최선을 다해 도와드릴게요.\n\n`
    
    if (profile?.conditions) {
      response += `📋 등록하신 기저 질환(${profile.conditions})을 고려해서 상담해 드릴게요.\n\n`
    }
    
    response += `어디가 불편하시거나, 궁금한 점이 있으세요?`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 일반 통증 (부위 불명확)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (containsAny(message, ['아프', '아파', '통증', '불편'])) {
    let response = `${honorific}, 불편하신 곳이 있으시군요. 😔\n\n`
    
    if (context.keywords.length > 0) {
      response += `**"${context.keywords.slice(0, 2).join(', ')}"**에 대해 말씀해 주셨네요.\n\n`
    }
    
    response += `조금 더 자세히 여쭤볼게요:\n`
    response += `• 어느 부위가 아프세요? (무릎, 허리, 어깨 등)\n`
    response += `• 언제부터 아프셨어요?\n`
    response += `• 특정 동작을 하면 더 아프신가요?\n\n`
    
    response += `알려주시면 맞춤 조언을 드릴 수 있어요!`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 기본 응답 (키워드 기반)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let response = `${honorific}, 말씀 감사해요. 😊\n\n`
  
  if (context.keywords.length > 0) {
    response += `**"${context.keywords.slice(0, 2).join(', ')}"**에 대해 말씀해 주셨네요.\n\n`
  }
  
  response += `조금 더 자세히 알려주시면 ${honorific}께 맞는 조언을 드릴 수 있어요.\n\n`
  response += `• 어떤 증상이 있으신지\n`
  response += `• 언제부터 시작됐는지\n`
  response += `• 어떤 상황에서 더 심해지는지\n\n`
  
  response += `편하게 말씀해 주세요!`
  
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
  
  if (error && error.code !== 'PGRST116') return { allowed: true, count: 0 }
  return { allowed: (data?.count || 0) < DAILY_LIMIT, count: data?.count || 0 }
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
      const { data } = await supabase.from('chat_usage').select('count').eq('user_id', userId).eq('date', today).single()
      if (data) await supabase.from('chat_usage').update({ count: data.count + 1 }).eq('user_id', userId).eq('date', today)
      else await supabase.from('chat_usage').insert({ user_id: userId, date: today, count: 1 })
    } catch {}
  }
}

// ========================
// 🚀 메인 API 핸들러
// ========================
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'JSON 형식 오류' }, { status: 400 })
    
    const { message } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }

    console.log('📩 [Chat API] 메시지:', message)

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })

    const { allowed, count } = await checkDailyLimit(supabase, user.id)
    if (!allowed) return NextResponse.json({ error: `일일 사용 제한(${DAILY_LIMIT}회) 초과`, dailyLimit: true, count }, { status: 429 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('age, gender, height, weight, conditions, medications')
      .eq('id', user.id)
      .single()

    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '회원'
    const reply = generateDynamicResponse(message, userName, profile)
    
    incrementUsage(supabase, user.id).catch(() => {})
    
    return NextResponse.json({ reply, usage: { count: count + 1, limit: DAILY_LIMIT, remaining: DAILY_LIMIT - count - 1 } })
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
