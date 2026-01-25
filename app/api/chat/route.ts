import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

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
// 🏥 시스템 프롬프트 생성
// ========================
function buildSystemPrompt(profile: UserProfile | null): string {
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null
  
  let systemPrompt = `당신은 20년 경력의 다정하고 전문적인 가정의학과 전문의입니다.

## 핵심 지침

### 페르소나
- 따뜻하고 공감 능력이 뛰어난 의사
- 부드러운 '해요체' 사용 (예: ~이에요, ~있어요, ~해보세요)
- 유저를 반드시 **'선생님'**이라고 호칭

### 답변 구조 (엄격히 준수)
1. **[따뜻한 공감]**: 유저의 상황에 공감하며 시작 (예: "많이 불편하셨겠어요", "걱정되셨죠")
2. **[데이터 기반 수치 분석]**: 프로필 데이터와 글로벌 의료 가이드라인 기반 분석
3. **[생활 처방]**: 구체적이고 실천 가능한 조언 제시
4. **[따뜻한 응원]**: 긍정적 메시지로 마무리

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
    systemPrompt += `\n## 현재 상담 중인 선생님의 건강 프로필\n`
    
    if (profile.age) {
      systemPrompt += `- 연령: ${profile.age}세\n`
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

  systemPrompt += `
## 응답 예시

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
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 일일 사용량 체크
    const { allowed, count } = await checkDailyLimit(supabase, user.id)
    if (!allowed) {
      return NextResponse.json({ 
        error: `일일 사용 제한(${DAILY_LIMIT}회)을 초과했습니다.`, 
        dailyLimit: true, 
        count 
      }, { status: 429 })
    }

    // 프로필 로드
    const { data: profile } = await supabase
      .from('profiles')
      .select('age, gender, height, weight, conditions, medications')
      .eq('id', user.id)
      .single()

    // 스마트 모델 라우팅
    const selectedModel = selectModel(message)
    console.log(`🤖 [Chat API] 선택된 모델: ${selectedModel === 'claude' ? 'Claude 3.5 Haiku' : 'GPT-4o-mini'}`)

    // 시스템 프롬프트 생성
    const systemPrompt = buildSystemPrompt(profile)

    // AI 응답 생성
    let reply: string
    let actualModel = selectedModel

    // API 키 확인
    const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    
    console.log(`🔑 [Chat API] API 키 상태 - Claude: ${hasClaudeKey ? '✅' : '❌'}, OpenAI: ${hasOpenAIKey ? '✅' : '❌'}`)

    // Claude 키만 있으면 항상 Claude 사용
    if (hasClaudeKey && !hasOpenAIKey) {
      actualModel = 'claude'
    }
    // OpenAI 키만 있으면 항상 OpenAI 사용
    else if (!hasClaudeKey && hasOpenAIKey) {
      actualModel = 'gpt'
    }
    // 둘 다 없으면 에러
    else if (!hasClaudeKey && !hasOpenAIKey) {
      console.error('❌ [Chat API] API 키가 설정되지 않았습니다!')
      return NextResponse.json({ 
        error: 'AI 서비스 API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' 
      }, { status: 500 })
    }

    try {
      console.log(`🤖 [Chat API] 실제 사용 모델: ${actualModel === 'claude' ? 'Claude 3.5 Haiku' : 'GPT-4o-mini'}`)
      
      if (actualModel === 'claude') {
        // Claude 3.5 Haiku
        const result = await generateText({
          model: anthropic('claude-3-5-haiku-latest'),
          system: systemPrompt,
          prompt: message,
        })
        reply = result.text
        console.log('✅ [Chat API] Claude 응답 성공')
      } else {
        // GPT-4o-mini
        const result = await generateText({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          prompt: message,
        })
        reply = result.text
        console.log('✅ [Chat API] OpenAI 응답 성공')
      }
    } catch (aiError: unknown) {
      console.error('❌ [Chat API] AI 호출 에러:', aiError)
      
      // 에러 상세 로깅
      if (aiError instanceof Error) {
        console.error('   - 에러 메시지:', aiError.message)
        console.error('   - 에러 이름:', aiError.name)
        
        // API 키 관련 에러 감지
        if (aiError.message.includes('API key') || aiError.message.includes('authentication') || aiError.message.includes('401')) {
          return NextResponse.json({ 
            error: 'API 키가 올바르지 않습니다. 관리자에게 문의하세요.',
            details: aiError.message
          }, { status: 401 })
        }
      }
      
      // Fallback: 기본 응답
      reply = `선생님, 죄송해요. 지금 시스템이 일시적으로 불안정해서 제가 제대로 답변을 드리기 어려워요. 😔

잠시 후 다시 시도해 주시겠어요? 선생님의 건강 상담을 도와드리고 싶어요!`
    }

    // 면책 조항 추가
    reply += DISCLAIMER

    // 사용량 증가
    incrementUsage(supabase, user.id).catch(() => {})
    
    console.log('✅ [Chat API] 응답 생성 완료')
    
    return NextResponse.json({ 
      reply,
      model: actualModel === 'claude' ? 'claude-3.5-haiku' : 'gpt-4o-mini',
      usage: { 
        count: count + 1, 
        limit: DAILY_LIMIT, 
        remaining: DAILY_LIMIT - count - 1 
      }
    })
    
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
