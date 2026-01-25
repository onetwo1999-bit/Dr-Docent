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
// 🔍 키워드 추출기
// ========================
function extractKeywords(message: string): string[] {
  const keywords: string[] = []
  
  // 치료/시술 관련
  const treatments = ['충격파', '침', '물리치료', '주사', '약', '수술', '도수치료', '운동치료', '스트레칭', '찜질', '파스', '진통제', '마사지', '정형외과', '한의원', '재활']
  treatments.forEach(t => { if (message.includes(t)) keywords.push(t) })
  
  // 증상 관련
  const symptoms = ['아프', '시큰', '쑤시', '저리', '붓', '뻣뻣', '찌릿', '욱신', '뜨끔', '결리', '당기', '무거', '피곤', '어지러', '두근']
  symptoms.forEach(s => { if (message.includes(s)) keywords.push(s) })
  
  // 상황/활동 관련
  const activities = ['계단', '앉', '일어', '걸', '뛰', '운동', '아르바이트', '알바', '일', '오래 서', '오래 앉', '출퇴근', '잠', '아침', '저녁', '밤']
  activities.forEach(a => { if (message.includes(a)) keywords.push(a) })
  
  // 시간 관련
  const timeWords = ['오래', '몇 달', '몇 년', '계속', '낫지 않', '호전', '악화', '반복', '만성']
  timeWords.forEach(t => { if (message.includes(t)) keywords.push(t) })
  
  return [...new Set(keywords)] // 중복 제거
}

// ========================
// 🧠 대화 컨텍스트 분석기
// ========================
function analyzeContext(message: string): {
  isFollowUp: boolean
  hasTreatmentHistory: boolean
  hasNoImprovement: boolean
  hasLifestyleFactor: boolean
  mainTopic: string | null
  keywords: string[]
} {
  const keywords = extractKeywords(message)
  const lowerMsg = message.toLowerCase()
  
  // 후속 질문 감지 (치료 경험 언급)
  const treatmentIndicators = ['받았', '했는데', '해봤', '먹었', '다녀', '갔는데', '치료']
  const isFollowUp = treatmentIndicators.some(t => message.includes(t))
  
  // 치료 후 호전 없음 감지
  const noImprovementIndicators = ['낫지 않', '호전이 없', '똑같', '여전히', '계속 아프', '나아지지', '효과가 없', '소용이 없', '안 낫']
  const hasNoImprovement = noImprovementIndicators.some(t => message.includes(t))
  
  // 생활 습관/직업 요인 감지
  const lifestyleIndicators = ['아르바이트', '알바', '일하', '직장', '회사', '서서', '앉아서', '무거운', '반복', '오래']
  const hasLifestyleFactor = lifestyleIndicators.some(t => message.includes(t))
  
  // 주요 토픽 결정
  let mainTopic: string | null = null
  if (lowerMsg.includes('무릎') || lowerMsg.includes('관절')) mainTopic = '무릎/관절'
  else if (lowerMsg.includes('허리') || lowerMsg.includes('요통')) mainTopic = '허리'
  else if (lowerMsg.includes('어깨') || lowerMsg.includes('목')) mainTopic = '어깨/목'
  else if (lowerMsg.includes('두통') || lowerMsg.includes('머리')) mainTopic = '두통'
  else if (lowerMsg.includes('소화') || lowerMsg.includes('위') || lowerMsg.includes('속')) mainTopic = '소화기'
  else if (lowerMsg.includes('피로') || lowerMsg.includes('피곤') || lowerMsg.includes('기운')) mainTopic = '피로'
  
  return {
    isFollowUp,
    hasTreatmentHistory: isFollowUp,
    hasNoImprovement,
    hasLifestyleFactor,
    mainTopic,
    keywords
  }
}

// ========================
// 💬 동적 심화 질문 생성기
// ========================
function generateFollowUpQuestion(topic: string | null, context: ReturnType<typeof analyzeContext>, profile: UserProfile | null): string {
  const questions: Record<string, string[]> = {
    '무릎/관절': [
      '혹시 계단을 내려갈 때 더 아프신가요, 아니면 올라갈 때 더 아프세요?',
      '앉았다 일어날 때 "뚝" 소리가 나기도 하나요?',
      '아침에 일어났을 때 뻣뻣한 느낌이 30분 이상 지속되나요?',
      '무릎이 붓거나 열감이 느껴지신 적 있으세요?',
      '쪼그려 앉는 자세를 자주 하시는 편인가요?'
    ],
    '허리': [
      '기침이나 재채기할 때 허리 통증이 더 심해지나요?',
      '다리 쪽으로 저린 느낌이 내려가기도 하나요?',
      '아침에 일어날 때와 저녁 중 언제 더 아프세요?',
      '오래 앉아 있다가 일어날 때 허리가 굳은 느낌이 드나요?',
      '무거운 물건을 드는 일을 자주 하시나요?'
    ],
    '어깨/목': [
      '팔을 위로 올릴 때 통증이 심해지나요?',
      '컴퓨터나 스마트폰을 하루에 몇 시간 정도 사용하세요?',
      '잘 때 어느 자세로 주무세요? 옆으로 자면 어깨가 아프기도 하나요?',
      '어깨를 돌릴 때 걸리는 느낌이나 소리가 나나요?'
    ],
    '두통': [
      '두통이 있을 때 빛이나 소리에 민감해지시나요?',
      '한쪽만 아프신가요, 아니면 양쪽 다 아프세요?',
      '두통이 시작되기 전에 뭔가 조짐이 느껴지나요?',
      '스트레스를 받거나 수면이 부족할 때 더 심해지나요?'
    ],
    '소화기': [
      '식사 후 바로 증상이 나타나나요, 아니면 공복에 더 불편하세요?',
      '특정 음식을 먹으면 더 안 좋아지는 게 있나요?',
      '속쓰림이 가슴 쪽까지 올라오는 느낌이 있으세요?',
      '최근 스트레스를 많이 받으셨나요?'
    ],
    '피로': [
      '밤에 잠은 잘 주무시는 편이에요? 중간에 자주 깨시나요?',
      '아침에 일어났을 때도 피곤하신가요?',
      '최근 식욕이나 체중에 변화가 있으셨나요?',
      '집중력이 떨어지거나 기분이 가라앉는 느낌도 있으세요?'
    ]
  }
  
  // 생활 습관 관련 추가 질문
  if (context.hasLifestyleFactor) {
    return '그 일을 하실 때 같은 자세를 얼마나 오래 유지하시나요? 휴식 시간은 충분히 갖고 계세요?'
  }
  
  // 호전 없음 관련
  if (context.hasNoImprovement) {
    return '치료를 받으신 기간이 얼마나 되셨어요? 그리고 치료 외에 일상에서 특별히 달라진 점이 있으셨나요?'
  }
  
  // 토픽별 질문
  if (topic && questions[topic]) {
    const topicQuestions = questions[topic]
    return topicQuestions[Math.floor(Math.random() * topicQuestions.length)]
  }
  
  // 기본 질문
  return '증상이 시작된 게 언제쯤부터인지 기억나세요?'
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
// 🏥 동적 대화형 AI 응답 생성
// ========================
function generateDynamicResponse(
  message: string, 
  userName: string, 
  profile: UserProfile | null
): string {
  const context = analyzeContext(message)
  const bmi = profile ? analyzeBMI(profile.height, profile.weight, profile.age) : null
  const honorific = '선생님'
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 치료 후 호전 없음 → 만성화/생활습관 분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.hasNoImprovement && context.keywords.length > 0) {
    const mentionedTreatments = context.keywords.filter(k => 
      ['충격파', '침', '물리치료', '주사', '약', '도수치료', '운동치료', '마사지'].includes(k)
    )
    
    let response = `${honorific}, **${mentionedTreatments.length > 0 ? mentionedTreatments.join(', ') + ' 치료' : '치료'}**를 받으셨는데도 나아지지 않으셨군요. 정말 답답하고 걱정되셨겠어요. 😔\n\n`
    
    response += `### 🔬 새로운 분석 관점\n\n`
    response += `글로벌 의료 가이드라인에 따르면, 치료에도 호전이 없는 경우 다음을 점검해 봐야 해요:\n\n`
    
    response += `**1. 만성 통증 전환 가능성**\n`
    response += `• 통증이 3개월 이상 지속되면 "만성 통증"으로 분류돼요\n`
    response += `• 만성 통증은 단순 구조적 문제가 아니라 **신경계 과민화**가 동반되는 경우가 많아요\n`
    response += `• 이 경우 국소 치료만으로는 한계가 있고, 통증 조절 + 생활 개선을 병행해야 해요\n\n`
    
    if (context.hasLifestyleFactor || context.keywords.some(k => ['아르바이트', '알바', '일', '오래'].includes(k))) {
      response += `**2. 생활 습관 요인 (${honorific} 상황 분석)**\n`
      response += `• ${honorific}께서 말씀하신 **${context.keywords.filter(k => ['아르바이트', '알바', '일', '오래 서', '오래 앉'].includes(k)).join(', ') || '일상 활동'}**이 회복을 방해하고 있을 수 있어요\n`
      response += `• 치료를 받아도 **같은 부하가 반복**되면 조직이 회복할 시간이 없어요\n`
      response += `• 마치 상처에 계속 자극을 주는 것과 같은 상황이에요\n\n`
    }
    
    if (bmi && bmi.value >= 25 && context.mainTopic?.includes('무릎')) {
      response += `**3. 체중과 역학적 부하**\n`
      response += `• 현재 BMI ${bmi.value}로, 무릎에 가해지는 부담이 커요\n`
      response += `• 적정 체중보다 ${bmi.excess}kg 높아, 무릎에 **약 ${bmi.excess * 4}kg의 추가 부하**가 걸리고 있어요\n`
      response += `• 아무리 좋은 치료를 받아도 이 부하가 유지되면 효과가 제한적이에요\n\n`
    }
    
    response += `### 💡 제안 드리는 점\n\n`
    response += `1. **통증 일지 작성**: 언제, 어떤 활동 후 악화되는지 기록해 보세요\n`
    response += `2. **활동 조절**: 가능하다면 부담을 주는 활동의 강도나 시간을 줄여보세요\n`
    response += `3. **전문의 재평가**: 기존 진단이 정확한지 재확인이 필요할 수 있어요\n\n`
    
    response += `---\n`
    response += `🤔 ${generateFollowUpQuestion(context.mainTopic, context, profile)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 치료 경험 언급 (후속 대화)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.isFollowUp && context.keywords.length > 0) {
    const treatments = context.keywords.filter(k => 
      ['충격파', '침', '물리치료', '주사', '도수치료', '운동치료', '마사지', '정형외과', '한의원'].includes(k)
    )
    
    let response = `${honorific}, **${treatments.join(', ')}** 치료를 받으셨군요!\n\n`
    
    if (treatments.includes('충격파')) {
      response += `충격파 치료는 힘줄이나 인대의 치유를 촉진하는 좋은 방법이에요. `
      response += `보통 1-2주 간격으로 3-5회 정도 받으시는 게 효과적이에요. `
      response += `치료 직후에는 오히려 통증이 살짝 증가할 수 있는데, 이건 정상적인 반응이에요.\n\n`
    }
    
    if (treatments.includes('침')) {
      response += `침 치료는 근육 긴장 완화와 혈액 순환 개선에 도움이 돼요. `
      response += `양방 치료와 병행하시는 것도 좋은 접근이에요.\n\n`
    }
    
    if (treatments.includes('물리치료')) {
      response += `물리치료는 꾸준히 받으시는 게 중요해요. `
      response += `집에서도 배우신 운동을 매일 해주시면 효과가 배가 돼요.\n\n`
    }
    
    response += `치료 효과가 어떠셨어요? `
    response += generateFollowUpQuestion(context.mainTopic, context, profile)
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 무릎/관절 통증 (첫 상담)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '무릎/관절') {
    let response = `${honorific}, 무릎이 불편하시군요. 많이 신경 쓰이셨겠어요. 😔\n\n`
    
    // 키워드 기반 맞춤 분석
    if (context.keywords.includes('시큰') || context.keywords.includes('쑤시')) {
      response += `**"시큰거리는" 느낌**은 관절 주변 연부조직의 염증이나 퇴행성 변화를 시사할 수 있어요.\n\n`
    }
    
    if (context.keywords.includes('계단')) {
      response += `**계단에서 악화**되는 양상은 슬개대퇴 관절(무릎뼈-허벅지뼈 사이) 문제일 가능성이 높아요.\n\n`
    }
    
    // BMI 연관 분석 (반복적 프로필 나열 대신 핵심만)
    if (bmi && bmi.value >= 25) {
      response += `💡 참고로, ${honorific}의 경우 체중 ${bmi.excess}kg만 줄이셔도 무릎 부담이 **${bmi.excess * 4}kg** 줄어들어요.\n\n`
    }
    
    // 나이 연관
    if (profile?.age && profile.age >= 50) {
      response += `${profile.age}세 연령대에서는 퇴행성 관절염이 흔해요. 하지만 관리하시면 충분히 좋아질 수 있으니 걱정 마세요!\n\n`
    }
    
    response += `---\n`
    response += `🤔 ${generateFollowUpQuestion('무릎/관절', context, profile)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 허리 통증
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '허리') {
    let response = `${honorific}, 허리가 불편하시군요. 일상생활이 힘드셨겠어요. 😔\n\n`
    
    if (context.keywords.includes('저리') || context.keywords.includes('찌릿')) {
      response += `**다리로 저린 느낌**이 있으시다면 디스크(추간판) 문제일 수 있어요. `
      response += `신경이 눌리면서 생기는 증상이에요.\n\n`
    }
    
    if (context.keywords.includes('뻣뻣') || context.keywords.includes('굳')) {
      response += `**뻣뻣한 느낌**은 근육 긴장이나 퇴행성 변화를 시사해요. `
      response += `아침에 특히 심하다면 근막 문제일 가능성이 높아요.\n\n`
    }
    
    if (context.hasLifestyleFactor) {
      response += `💡 말씀하신 **${context.keywords.filter(k => ['아르바이트', '알바', '일', '오래'].includes(k)).join(', ')}** 상황이 허리에 부담을 주고 있을 수 있어요.\n\n`
    }
    
    response += `---\n`
    response += `🤔 ${generateFollowUpQuestion('허리', context, profile)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 두통
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '두통') {
    let response = `${honorific}, 머리가 아프시군요. 정말 힘드셨겠어요. 😔\n\n`
    
    if (context.keywords.includes('한쪽') || message.includes('편두통')) {
      response += `**한쪽만 아프시다면** 편두통일 가능성이 있어요. `
      response += `빛이나 소리에 민감해지거나 메스꺼움이 동반되기도 해요.\n\n`
    }
    
    if (context.keywords.includes('뒷') || message.includes('목')) {
      response += `**뒷머리나 목 부분**이 아프시다면 긴장성 두통일 수 있어요. `
      response += `스트레스나 자세 문제가 원인인 경우가 많아요.\n\n`
    }
    
    if (profile?.conditions?.includes('고혈압')) {
      response += `⚠️ ${honorific}은 고혈압 기왕력이 있으시니, 혈압을 한번 체크해 보시는 게 좋겠어요.\n\n`
    }
    
    response += `---\n`
    response += `🤔 ${generateFollowUpQuestion('두통', context, profile)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 피로
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '피로') {
    let response = `${honorific}, 요즘 많이 지치셨나 봐요. 몸이 보내는 신호일 수 있어요. 😔\n\n`
    
    if (context.keywords.includes('아침')) {
      response += `**아침부터 피곤하시다면** 수면의 질이 좋지 않거나, 갑상선 기능 저하 가능성도 있어요.\n\n`
    }
    
    if (context.keywords.includes('무기력') || context.keywords.includes('기운')) {
      response += `**무기력함**이 2주 이상 지속되신다면 철분 부족이나 우울감도 체크해 볼 필요가 있어요.\n\n`
    }
    
    if (context.hasLifestyleFactor) {
      response += `💡 말씀하신 **${context.keywords.filter(k => ['아르바이트', '알바', '일'].includes(k)).join(', ')}** 때문에 더 지치셨을 수 있어요.\n\n`
    }
    
    response += `---\n`
    response += `🤔 ${generateFollowUpQuestion('피로', context, profile)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 소화기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (context.mainTopic === '소화기') {
    let response = `${honorific}, 속이 불편하시군요. 식사도 힘드셨겠어요. 😔\n\n`
    
    if (context.keywords.includes('속쓰림') || message.includes('역류')) {
      response += `**속쓰림**은 위산 역류를 시사해요. `
      response += `식후 바로 눕지 않고, 2시간은 앉아 계시는 게 좋아요.\n\n`
    }
    
    if (bmi && bmi.value >= 25) {
      response += `💡 복부 비만은 위산 역류를 악화시켜요. 체중 관리도 도움이 될 수 있어요.\n\n`
    }
    
    response += `---\n`
    response += `🤔 ${generateFollowUpQuestion('소화기', context, profile)}`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 인사
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (message.includes('안녕') || message.includes('하이') || message.toLowerCase().includes('hello')) {
    let response = `${honorific}, 안녕하세요! 반가워요. 😊\n\n`
    response += `저는 20년 경력의 가정의학과 전문의예요. `
    response += `${honorific}의 건강 고민을 편하게 말씀해 주시면, 제가 최선을 다해 도와드릴게요.\n\n`
    
    if (profile?.conditions) {
      response += `📋 등록하신 기저 질환(${profile.conditions})을 고려해서 상담해 드릴게요.\n\n`
    }
    
    response += `어디가 불편하시거나, 요즘 몸에서 느껴지는 변화가 있으세요?`
    
    return response + DISCLAIMER
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔹 기본 응답 (유도 질문으로)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let response = `${honorific}, 말씀 감사해요. 😊\n\n`
  
  // 키워드가 있으면 인용
  if (context.keywords.length > 0) {
    response += `**"${context.keywords.slice(0, 2).join(', ')}"**에 대해 말씀해 주셨네요.\n\n`
  }
  
  response += `조금 더 자세히 여쭤봐도 될까요?\n\n`
  response += `• 증상이 언제부터 시작됐는지\n`
  response += `• 어떤 상황에서 더 심해지는지\n`
  response += `• 다른 불편함은 없으신지\n\n`
  response += `알려주시면 ${honorific}께 맞는 조언을 드릴 수 있어요!`
  
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
