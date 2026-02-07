import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { streamText } from 'ai'
import { smoothStream } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { getAgeFromBirthDate, getAgeContextForAI } from '@/utils/health'
import { aggregateHealthContext, formatAggregateForPrompt } from '@/utils/health-aggregator'

// 매 요청마다 최신 DB 조회 (대시보드 기록 반영). 캐시 사용 안 함.
export const dynamic = 'force-dynamic'

// ========================
// 🔧 설정 상수
// ========================
const DAILY_LIMIT = 10
const DISCLAIMER = '\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ 본 서비스는 의학적 진단을 대신하지 않습니다. 정확한 진단은 전문의와 상담해 주세요.'

// ========================
// 📊 유저 프로필 타입
// ========================
interface UserProfile {
  birth_date: string | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

// ========================
// 🧮 BMI 계산
// ========================
function calculateBMI(height: number | null, weight: number | null): { value: number; category: string } | null {
  if (!height || !weight || height <= 0) return null
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  
  let category = '정상'
  if (bmi < 18.5) category = '저체중'
  else if (bmi < 23) category = '정상'
  else if (bmi < 25) category = '과체중'
  else if (bmi < 30) category = '비만 1단계'
  else category = '비만 2단계'
  
  return { value: bmiRounded, category }
}

// ========================
// 🔀 스마트 모델 라우터
// ========================
function selectModel(message: string): 'claude' | 'gpt' {
  const medicalKeywords = [
    '통증', '분석', '증상', '수치', 'bmi', 'BMI', '치료', '처방', '약', '병원',
    '아프', '아파', '두통', '소화', '피로', '무릎', '허리', '어깨', '관절',
    '질환', '질병', '진단', '검사', '혈압', '당뇨', '콜레스테롤', '건강',
    '운동', '다이어트', '체중', '비만', '영양', '식단', '수면', '스트레스',
    '호전', '악화', '만성', '급성', '염증', '감염', '알레르기'
  ]
  
  const lowerMessage = message.toLowerCase()
  const isMedicalQuery = medicalKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  )
  
  return isMedicalQuery ? 'claude' : 'gpt'
}

// ========================
// 📋 건강 데이터 로깅
// ========================
function logHealthProfile(profile: UserProfile | null, userId: string): void {
  console.log('\n' + '='.repeat(50))
  console.log('📊 [건강 데이터 로깅] 사용자:', userId.slice(0, 8) + '...')
  console.log('='.repeat(50))
  
  if (!profile) {
    console.log('⚠️ 프로필 없음 - 기본 상담 모드')
    return
  }
  
  const bmi = calculateBMI(profile.height, profile.weight)
  const age = getAgeFromBirthDate(profile.birth_date)
  
  console.log('👤 나이:', age != null ? `${age}세` : '미입력')
  console.log('⚧️ 성별:', profile.gender === 'male' ? '남성' : profile.gender === 'female' ? '여성' : '미입력')
  console.log('📏 신장:', profile.height ? `${profile.height}cm` : '미입력')
  console.log('⚖️ 체중:', profile.weight ? `${profile.weight}kg` : '미입력')
  
  if (bmi) {
    console.log(`📈 BMI: ${bmi.value} (${bmi.category})`)
    
    // 비만 경고
    if (bmi.value >= 25) {
      const idealWeight = Math.round(23 * Math.pow((profile.height || 170) / 100, 2))
      const excess = (profile.weight || 0) - idealWeight
      console.log(`⚠️ 과체중 경고: 적정 체중보다 ${excess}kg 초과`)
      console.log(`   - 관절 부하 추정: ${excess * 4}kg`)
    }
  }
  
  if (profile.conditions) {
    console.log('🏥 기저 질환:', profile.conditions)
    
    // 특정 질환 감지
    const conditionsLower = profile.conditions.toLowerCase()
    if (conditionsLower.includes('고혈압')) console.log('   ⚠️ 고혈압 환자 - 혈압 관련 조언 주의')
    if (conditionsLower.includes('당뇨')) console.log('   ⚠️ 당뇨 환자 - 혈당/식이 조언 주의')
    if (conditionsLower.includes('관절') || conditionsLower.includes('허리')) {
      console.log('   ⚠️ 근골격계 문제 - 운동 강도 조절 필요')
    }
  } else {
    console.log('🏥 기저 질환: 없음')
  }
  
  if (profile.medications) {
    console.log('💊 복용 약물:', profile.medications)
    console.log('   ⚠️ 약물 상호작용 주의 필요')
  } else {
    console.log('💊 복용 약물: 없음')
  }
  
  console.log('='.repeat(50) + '\n')
}

// ========================
// 🏥 앱 컨텍스트 타입
// ========================
interface AppContextForAPI {
  recentActions?: Array< { type: string; label: string; detail?: string; path?: string } >
  hesitationHint?: boolean
}

// ========================
// 🏥 시스템 프롬프트 생성
// ========================
function buildSystemPrompt(
  profile: UserProfile | null,
  currentHealthContext: string | null,
  appContext?: AppContextForAPI | null
): string {
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null
  
  let systemPrompt = `당신은 20년 경력의 다정하고 전문적인 가정의학과 전문의이자, **사용자의 실시간 대시보드 데이터를 분석하는 전문가**입니다.

## 핵심 지침

### 역할
- 단순히 채팅하는 AI가 아니라, **선생님의 최신 건강 기록(수면·운동·식단·복약·랭킹)을 매 요청 시점에 반영**해 분석합니다.
- 사용자가 묻지 않아도, **데이터상 특이점**이 보이면 먼저 언급하며 의견을 제시하세요.
  예: 수면 부족 후 고강도 운동일, 복약은 잘 지키는데 수면이 4시간대로 떨어진 날, 랭킹 1위인데 당일 운동 강도 과다 등.
- **데이터 간 상관관계**를 찾아 의견을 전달하세요. 사실 나열이 아니라, "지난 3일간 복약은 완벽하지만 수면이 4시간대로 떨어졌습니다", "랭킹 1위도 좋지만 오늘 운동 강도는 조절이 필요해 보입니다"처럼 **철저히 수준 높은 데이터 기반 코칭**을 하세요.
- 모든 의견은 **의료법 범위를 넘지 않는 '코칭' 어조**를 유지하고, 진단·처방이 아닌 생활 습관 조언으로 한정하세요.

### 페르소나
- 따뜻하고 공감 능력이 뛰어난 의사
- 부드러운 '해요체' 사용 (예: ~이에요, ~있어요, ~해보세요)
- 유저를 반드시 **'선생님'**이라고 호칭

### 답변 구조 (엄격히 준수)
- **전체 답변은 반드시 800 토큰 이내**로 작성하세요. 핵심만 간결하게 전달하세요.
- **맨 처음에 반드시 핵심 요약을 불릿 포인트(•)로 3~5개** 배치한 뒤, 이어서 본문을 작성하세요.
  예시:
  • 요약 1
  • 요약 2
  • 요약 3
  (이후 본문: 공감 → 데이터 분석 → 생활 처방 → 응원)
1. **[핵심 요약]**: 답변 맨 상단에 불릿(•)으로 핵심만 3~5개 나열
2. **[따뜻한 공감]**: 유저의 상황에 공감하며 시작
3. **[데이터 기반 수치·최신 기록 분석]**: 프로필 + [최신 건강 상태 요약] 데이터 기반 분석. 특이점이 있으면 짚어 주세요.
4. **[생활 처방]**: 구체적이고 실천 가능한 조언 제시
5. **[따뜻한 응원]**: 긍정적 메시지로 마무리

### 금기사항
- '존스홉킨스' 또는 특정 병원 이름 절대 언급 금지
- 대신 **'글로벌 의료 가이드라인'**에 근거한다고 명시
- 유저의 말을 그대로 반복하지 않기
- 고정된 예시 질문 리스트 붙이지 않기

### 대화 기법
- 유저의 키워드를 **인용**하며 대화 연결
- 상황에 맞는 **심화 질문** 하나로 마무리
- 프로필 전체를 매번 나열하지 않고, 관련된 데이터만 언급

`

  // 유저 프로필 데이터 주입
  if (profile) {
    const age = getAgeFromBirthDate(profile.birth_date)
    const ageContext = getAgeContextForAI(age, profile.birth_date)
    
    systemPrompt += `\n## 현재 상담 중인 선생님의 건강 프로필\n`
    
    if (ageContext) {
      systemPrompt += `- ${ageContext}\n`
      systemPrompt += `- 답변 시 예: "올해 OO세가 되셨으니, 혈압 관리에 조금 더 주의가 필요합니다"처럼 나이와 연령대를 인지한 맞춤 조언을 해주세요.\n`
    }
    if (age != null) {
      systemPrompt += `- 연령: ${age}세 (생년월일 기반 만 나이, 매년 자동 갱신)\n`
    }
    if (profile.gender) {
      systemPrompt += `- 성별: ${profile.gender === 'male' ? '남성' : '여성'}\n`
    }
    if (profile.height && profile.weight) {
      systemPrompt += `- 신체: ${profile.height}cm / ${profile.weight}kg\n`
      if (bmi) {
        systemPrompt += `- BMI: ${bmi.value} (${bmi.category})\n`
        
        if (bmi.value >= 25) {
          const idealWeight = Math.round(23 * Math.pow(profile.height / 100, 2))
          const excess = profile.weight - idealWeight
          systemPrompt += `- 참고: 적정 체중보다 약 ${excess}kg 높음. 무릎 등 하체 관절에 추가 부하 ${excess * 4}kg 추정\n`
        }
      }
    }
    if (profile.conditions) {
      systemPrompt += `- 기저 질환: ${profile.conditions}\n`
      systemPrompt += `  (⚠️ 이 정보를 반드시 고려하여 조언할 것)\n`
    }
    if (profile.medications) {
      systemPrompt += `- 복용 약물: ${profile.medications}\n`
      systemPrompt += `  (⚠️ 약물 상호작용 및 부작용 가능성 고려할 것)\n`
    }
  } else {
    systemPrompt += `\n## 건강 프로필\n아직 등록된 건강 프로필이 없습니다. 맞춤 상담을 위해 프로필 등록을 권유하세요.\n`
  }

  if (currentHealthContext) {
    systemPrompt += `\n## 최신 건강 상태 요약 (Current Health Context)\n아래는 **최근 7일간** 대시보드에 기록된 데이터의 요약입니다. 매 채팅 요청 시점마다 갱신되므로, 방금 기록한 식사·운동·수면·복약도 반영됩니다. 답변 시 이 데이터를 우선 참고하고, 특이점·상관관계가 있으면 먼저 언급하세요.\n\n\`\`\`\n${currentHealthContext}\n\`\`\`\n`
  }

  if (appContext?.recentActions?.length) {
    const lines = appContext.recentActions.map(
      (a) => `- ${a.label}${a.detail ? ` (${a.detail})` : ''}${a.path ? ` [${a.path}]` : ''}`
    )
    systemPrompt += `\n## 앱 내 최근 행동 (선생님이 방금 하신 일)\n아래는 선생님이 앱에서 방금 하신 행동입니다. 답변 시 이걸 반영해 주세요.\n예: 생년월일 수정 직후 "나 어때?"라고 물으면 → "방금 생년월일을 수정하셨네요! 바뀐 나이(OO세)에 맞춰 심박수 기준을 다시 설정했습니다."처럼 앱 내 활동을 즉시 언급하세요.\n\n${lines.join('\n')}\n\n`
  }

  if (appContext?.hesitationHint) {
    systemPrompt += `\n## 프로액티브 제안\n선생님이 최근에 기록 없이 대시보드를 오래 보셨을 수 있습니다. 적절한 타이밍에 "기록에 어려움이 있으신가요? 제가 도와드릴까요?" 같은 배려 있는 제안을 할 수 있습니다.\n\n`
  }

  systemPrompt += `
## 응답 예시 (상단 불릿 요약 + 800 토큰 이내)

• 무릎 부담은 체중 관리로 줄일 수 있어요
• BMI 27.3, 적정 체중까지 5kg 감량 권장
• 계단 대신 엘리베이터·수중 운동 추천

선생님, 무릎이 많이 불편하시군요. 계단을 내려갈 때 특히 아프시다니 정말 힘드셨겠어요. 😔

**[데이터 분석]**
선생님의 BMI 27.3은 과체중 범위예요. 글로벌 의료 가이드라인에 따르면, 체중 1kg 증가 시 무릎에 가해지는 부하는 약 4kg 증가해요. 현재 무릎에 약 28kg의 추가 부담이 가고 있을 수 있어요.

**[생활 처방]**
1. 체중 관리가 가장 효과적인 치료예요. 5kg만 빼셔도 무릎 부담이 20kg 줄어들어요.
2. 계단 대신 엘리베이터를 이용해 주세요.
3. 수영이나 아쿠아로빅 같은 수중 운동이 관절에 부담 없이 좋아요.

**[응원]**
선생님, 지금처럼 건강에 관심을 가지시는 것만으로도 정말 잘하고 계신 거예요. 조금씩 실천하시면 분명 좋아지실 거예요! 💪

---
🤔 혹시 아침에 일어나실 때 무릎이 뻣뻣한 느낌이 있으세요?
`

  return systemPrompt
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
    const { data } = await supabase.from('chat_usage').select('count').eq('user_id', userId).eq('date', today).single()
    if (data) {
      await supabase.from('chat_usage').update({ count: data.count + 1 }).eq('user_id', userId).eq('date', today)
    } else {
      await supabase.from('chat_usage').insert({ user_id: userId, date: today, count: 1 })
    }
  } catch {
    // 테이블 없으면 무시
  }
}

// ========================
// 🔑 API 키 검증
// ========================
function validateApiKeys(): { 
  hasClaudeKey: boolean; 
  hasOpenAIKey: boolean; 
  claudeKeyPreview: string;
  openAIKeyPreview: string;
  claudeKeyRaw: string;
  openAIKeyRaw: string;
} {
  const claudeKey = process.env.ANTHROPIC_API_KEY || ''
  const openAIKey = process.env.OPENAI_API_KEY || ''
  
  // OpenAI는 sk- 또는 sk-svcacct- (서비스 계정) 형식 지원
  const isValidOpenAIKey = openAIKey.length > 10 && (
    openAIKey.startsWith('sk-') || 
    openAIKey.startsWith('sk-svcacct-') ||
    openAIKey.startsWith('sk-proj-')
  )
  
  // Anthropic은 sk-ant- 형식
  const isValidClaudeKey = claudeKey.length > 10 && claudeKey.startsWith('sk-ant-')
  
  return {
    hasClaudeKey: isValidClaudeKey,
    hasOpenAIKey: isValidOpenAIKey,
    claudeKeyPreview: claudeKey ? `${claudeKey.slice(0, 10)}...${claudeKey.slice(-4)}` : '(없음)',
    openAIKeyPreview: openAIKey ? `${openAIKey.slice(0, 10)}...${openAIKey.slice(-4)}` : '(없음)',
    claudeKeyRaw: claudeKey.length > 0 ? `길이=${claudeKey.length}` : '빈 문자열',
    openAIKeyRaw: openAIKey.length > 0 ? `길이=${openAIKey.length}` : '빈 문자열',
  }
}

// ========================
// 🚀 메인 API 핸들러
// ========================
export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
  const startTime = Date.now()
  
  console.log('\n' + '🏥'.repeat(25))
  console.log(`📩 [Chat API] 요청 시작 (ID: ${requestId})`)
  console.log('🏥'.repeat(25))
  
  try {
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'JSON 형식 오류' }, { status: 400 })
    
    const { message, recentActions, hesitationHint } = body
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }
    const appContext: AppContextForAPI | null =
      Array.isArray(recentActions) || typeof hesitationHint === 'boolean'
        ? { recentActions: Array.isArray(recentActions) ? recentActions : [], hesitationHint: !!hesitationHint }
        : null

    console.log(`💬 [${requestId}] 메시지: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`)

    // Supabase 클라이언트 생성
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

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log(`❌ [${requestId}] 인증 실패:`, authError?.message || '유저 없음')
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }
    
    console.log(`👤 [${requestId}] 사용자: ${user.email}`)

    // 일일 사용량 체크
    const { allowed, count } = await checkDailyLimit(supabase, user.id)
    if (!allowed) {
      console.log(`⛔ [${requestId}] 일일 한도 초과: ${count}/${DAILY_LIMIT}`)
      return NextResponse.json({ 
        error: `일일 사용 제한(${DAILY_LIMIT}회)을 초과했습니다.`, 
        dailyLimit: true, 
        count 
      }, { status: 429 })
    }

    // 프로필 로드
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('birth_date, gender, height, weight, conditions, medications')
      .eq('id', user.id)
      .single()
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.log(`⚠️ [${requestId}] 프로필 로드 에러:`, profileError.message)
    }

    // 🔍 건강 데이터 로깅 (상세)
    logHealthProfile(profile, user.id)

    // 최근 7일 데이터 집계 (캐시 없음, 매 요청마다 최신 반영)
    let currentHealthContext: string | null = null
    try {
      const aggregate = await aggregateHealthContext(supabase, user.id)
      currentHealthContext = formatAggregateForPrompt(aggregate)
      console.log(`📊 [${requestId}] 건강 컨텍스트 집계 완료 (${aggregate.period.start} ~ ${aggregate.period.end})`)
    } catch (aggErr) {
      console.warn(`⚠️ [${requestId}] 건강 집계 실패 (상담은 계속 진행):`, aggErr)
    }

    // 스마트 모델 라우팅
    const selectedModel = selectModel(message)
    console.log(`🤖 [${requestId}] 선택된 모델: ${selectedModel === 'claude' ? 'Claude 3.5 Haiku (20241022)' : 'GPT-4o-mini'}`)

    // 시스템 프롬프트 생성 (프로필 + 최신 건강 요약 + 앱 컨텍스트)
    const systemPrompt = buildSystemPrompt(profile, currentHealthContext, appContext)

    // 🔑 API 키 검증 (상세)
    const apiKeys = validateApiKeys()
    console.log(`🔑 [${requestId}] API 키 상태:`)
    console.log(`   - ANTHROPIC_API_KEY: ${apiKeys.hasClaudeKey ? '✅ ' + apiKeys.claudeKeyPreview : '❌ 없음'} (${apiKeys.claudeKeyRaw})`)
    console.log(`   - OPENAI_API_KEY: ${apiKeys.hasOpenAIKey ? '✅ ' + apiKeys.openAIKeyPreview : '❌ 없음'} (${apiKeys.openAIKeyRaw})`)
    console.log(`   - 환경: ${process.env.NODE_ENV || 'unknown'}`)

    // AI 응답 생성 (스트리밍)
    let actualModel = selectedModel
    if (apiKeys.hasClaudeKey && !apiKeys.hasOpenAIKey) {
      actualModel = 'claude'
      console.log(`📍 [${requestId}] Claude 전용 모드 (OpenAI 키 없음)`)
    } else if (!apiKeys.hasClaudeKey && apiKeys.hasOpenAIKey) {
      actualModel = 'gpt'
      console.log(`📍 [${requestId}] OpenAI 전용 모드 (Claude 키 없음)`)
    } else if (!apiKeys.hasClaudeKey && !apiKeys.hasOpenAIKey) {
      console.error(`❌ [${requestId}] 치명적 오류: API 키가 설정되지 않았습니다!`)
      return NextResponse.json({ 
        error: 'AI 서비스 API 키가 설정되지 않았습니다.',
        details: 'Vercel 환경 변수에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 설정해주세요.',
      }, { status: 500 })
    }

    const model = actualModel === 'claude'
      ? anthropic('claude-3-5-haiku-20241022')
      : openai('gpt-4o-mini')

    console.log(`🚀 [${requestId}] AI 스트리밍 시작: ${actualModel === 'claude' ? 'Claude 3.5 Haiku' : 'GPT-4o-mini'}`)

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: message,
      maxTokens: 800,
      experimental_transform: smoothStream(),
      onError({ error }) {
        console.error(`❌ [${requestId}] 스트림 에러:`, error)
      },
      onFinish() {
        incrementUsage(supabase, user.id).catch(() => {})
        console.log(`✅ [${requestId}] 스트림 완료`)
      },
    })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.enqueue(encoder.encode(DISCLAIMER))
        } catch (err) {
          console.error(`❌ [${requestId}] 스트림 읽기 오류:`, err)
          controller.enqueue(encoder.encode('\n\n선생님, 일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
    
  } catch (error) {
    console.error(`❌ [${requestId}] 예외 발생:`, error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
