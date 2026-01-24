import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ========================
// 🔧 설정 상수
// ========================
const DAILY_LIMIT = 10  // 하루 채팅 제한 횟수
const DISCLAIMER = '\n\n---\n⚠️ 본 서비스는 의학적 진단을 대신하지 않습니다. 정확한 진단과 치료는 반드시 전문의와 상담하세요.'

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
// 🧮 BMI 계산 함수
// ========================
function calculateBMI(height: number | null, weight: number | null): { value: number; category: string; advice: string } | null {
  if (!height || !weight || height <= 0) return null
  
  const heightInMeters = height / 100
  const bmi = weight / (heightInMeters * heightInMeters)
  
  let category: string
  let advice: string
  
  if (bmi < 18.5) {
    category = '저체중'
    advice = '균형 잡힌 영양 섭취와 적절한 칼로리 보충을 권장합니다.'
  } else if (bmi < 23) {
    category = '정상'
    advice = '건강한 체중을 유지하고 계십니다. 현재 생활습관을 유지하세요.'
  } else if (bmi < 25) {
    category = '과체중'
    advice = '규칙적인 유산소 운동과 식이 조절을 권장합니다.'
  } else if (bmi < 30) {
    category = '비만 1단계'
    advice = '체중 관리가 필요합니다. 전문가 상담을 권장합니다.'
  } else {
    category = '비만 2단계 이상'
    advice = '건강 위험이 높습니다. 전문의 상담을 강력히 권장합니다.'
  }
  
  return { value: Math.round(bmi * 10) / 10, category, advice }
}

// ========================
// 🤖 AI 응답 생성 (글로벌 의료 가이드라인 기반)
// ========================
function generateAIResponse(
  message: string, 
  userName: string, 
  profile: UserProfile | null
): string {
  const lowerMessage = message.toLowerCase()
  
  // 프로필 기반 BMI 계산
  const bmiData = profile ? calculateBMI(profile.height, profile.weight) : null
  
  // 유저 컨텍스트 문자열 생성
  const userContext = profile ? buildUserContext(profile, bmiData) : ''
  
  // 기저 질환 체크
  const hasConditions = profile?.conditions && profile.conditions.trim() !== ''
  const hasMedications = profile?.medications && profile.medications.trim() !== ''
  
  // ========================
  // 증상별 맞춤 응답
  // ========================
  
  // 두통
  if (lowerMessage.includes('두통') || lowerMessage.includes('머리가 아') || lowerMessage.includes('머리 아')) {
    let response = `${userName}님, 두통 증상에 대해 분석해 드리겠습니다.\n\n`
    response += `**글로벌 의료 가이드라인에 따른 분석:**\n\n`
    
    if (bmiData && bmiData.value >= 25) {
      response += `• 현재 BMI(${bmiData.value})가 높은 편으로, 고혈압과 관련된 두통일 가능성이 있습니다.\n`
    }
    
    if (hasConditions && profile?.conditions?.toLowerCase().includes('고혈압')) {
      response += `• ⚠️ 고혈압 기왕력이 있으시므로, 혈압 측정을 먼저 권장합니다.\n`
    }
    
    if (hasMedications) {
      response += `• 현재 복용 중인 약물(${profile?.medications})과의 상호작용도 고려해야 합니다.\n`
    }
    
    response += `\n**권장 조치:**\n`
    response += `1. 충분한 수분 섭취 (하루 2L 이상)\n`
    response += `2. 어둡고 조용한 환경에서 휴식\n`
    response += `3. 목과 어깨 스트레칭\n`
    response += `4. 증상이 3일 이상 지속되거나 심해지면 전문의 상담 필요\n`
    
    return response + userContext + DISCLAIMER
  }
  
  // 소화/위장
  if (lowerMessage.includes('소화') || lowerMessage.includes('위') || lowerMessage.includes('속쓰림') || lowerMessage.includes('배가 아')) {
    let response = `${userName}님, 소화기 증상에 대해 분석해 드리겠습니다.\n\n`
    response += `**글로벌 의료 가이드라인에 따른 분석:**\n\n`
    
    if (bmiData) {
      if (bmiData.value >= 25) {
        response += `• BMI(${bmiData.value})가 높을 경우 위식도 역류 위험이 증가합니다.\n`
      }
    }
    
    if (hasConditions && profile?.conditions?.toLowerCase().includes('당뇨')) {
      response += `• ⚠️ 당뇨 기왕력이 있으시므로, 당뇨성 위장관 합병증 가능성을 고려해야 합니다.\n`
    }
    
    response += `\n**권장 조치:**\n`
    response += `1. 식사량을 줄이고 여러 번 나눠서 섭취\n`
    response += `2. 식후 2시간 동안 눕지 않기\n`
    response += `3. 맵고 기름진 음식 피하기\n`
    response += `4. 증상이 1주일 이상 지속되면 내시경 검사 권장\n`
    
    return response + userContext + DISCLAIMER
  }
  
  // 피로/수면
  if (lowerMessage.includes('피곤') || lowerMessage.includes('피로') || lowerMessage.includes('졸려') || lowerMessage.includes('잠')) {
    let response = `${userName}님, 피로감에 대해 분석해 드리겠습니다.\n\n`
    response += `**글로벌 의료 가이드라인에 따른 분석:**\n\n`
    
    if (profile?.age && profile.age >= 40) {
      response += `• ${profile.age}세 연령대에서는 갑상선 기능 검사를 권장합니다.\n`
    }
    
    if (bmiData) {
      if (bmiData.value >= 30) {
        response += `• BMI(${bmiData.value})가 높은 경우 수면무호흡증 위험이 증가합니다.\n`
      } else if (bmiData.value < 18.5) {
        response += `• 저체중(BMI ${bmiData.value})은 영양 결핍으로 인한 피로를 유발할 수 있습니다.\n`
      }
    }
    
    if (hasConditions && profile?.conditions?.toLowerCase().includes('당뇨')) {
      response += `• ⚠️ 당뇨 기왕력: 혈당 변동이 피로의 원인일 수 있습니다.\n`
    }
    
    response += `\n**권장 조치:**\n`
    response += `1. 규칙적인 수면 스케줄 유지 (7-9시간)\n`
    response += `2. 철분, 비타민 B12, 비타민 D 섭취 확인\n`
    response += `3. 하루 30분 이상 유산소 운동\n`
    response += `4. 2주 이상 지속 시 혈액검사 권장\n`
    
    return response + userContext + DISCLAIMER
  }
  
  // 감기/호흡기
  if (lowerMessage.includes('감기') || lowerMessage.includes('기침') || lowerMessage.includes('콧물') || lowerMessage.includes('목아')) {
    let response = `${userName}님, 호흡기 증상에 대해 분석해 드리겠습니다.\n\n`
    response += `**글로벌 의료 가이드라인에 따른 분석:**\n\n`
    
    if (profile?.age && profile.age >= 65) {
      response += `• ⚠️ 65세 이상에서는 호흡기 감염 합병증 위험이 높습니다. 조기 진료를 권장합니다.\n`
    }
    
    if (hasConditions) {
      if (profile?.conditions?.toLowerCase().includes('천식') || profile?.conditions?.toLowerCase().includes('폐')) {
        response += `• ⚠️ 호흡기 질환 기왕력이 있으므로 증상 악화 시 즉시 진료 필요합니다.\n`
      }
    }
    
    response += `\n**권장 조치:**\n`
    response += `1. 충분한 수분 섭취와 휴식\n`
    response += `2. 실내 습도 50-60% 유지\n`
    response += `3. 손 씻기 등 위생 관리 철저\n`
    response += `4. 38.5°C 이상 고열, 호흡곤란 시 즉시 병원 방문\n`
    
    return response + userContext + DISCLAIMER
  }
  
  // 운동/다이어트 관련
  if (lowerMessage.includes('운동') || lowerMessage.includes('다이어트') || lowerMessage.includes('살') || lowerMessage.includes('체중')) {
    let response = `${userName}님, 체중 관리에 대해 분석해 드리겠습니다.\n\n`
    response += `**글로벌 의료 가이드라인에 따른 맞춤 분석:**\n\n`
    
    if (bmiData) {
      response += `📊 **현재 BMI: ${bmiData.value} (${bmiData.category})**\n`
      response += `• ${bmiData.advice}\n\n`
      
      if (bmiData.value >= 25) {
        const targetWeight = Math.round(22 * Math.pow((profile?.height || 170) / 100, 2))
        response += `🎯 **건강 체중 목표:** 약 ${targetWeight}kg\n`
        response += `• 주당 0.5-1kg 감량이 건강한 속도입니다.\n\n`
      }
    }
    
    if (hasConditions) {
      if (profile?.conditions?.toLowerCase().includes('당뇨')) {
        response += `⚠️ **당뇨 고려사항:** 급격한 식이 제한은 피하고, 혈당 모니터링과 함께 점진적 체중 관리를 권장합니다.\n\n`
      }
      if (profile?.conditions?.toLowerCase().includes('고혈압')) {
        response += `⚠️ **고혈압 고려사항:** 고강도 무산소 운동보다 유산소 운동을 권장합니다.\n\n`
      }
    }
    
    response += `**권장 운동 프로그램:**\n`
    
    if (profile?.age && profile.age >= 50) {
      response += `• 저강도 유산소 (걷기, 수영) 30분, 주 5회\n`
      response += `• 관절에 무리가 가지 않는 스트레칭\n`
    } else {
      response += `• 중강도 유산소 30분, 주 5회\n`
      response += `• 근력 운동 주 2-3회\n`
    }
    
    return response + userContext + DISCLAIMER
  }
  
  // BMI 관련 질문
  if (lowerMessage.includes('bmi') || lowerMessage.includes('비만')) {
    if (!bmiData) {
      return `${userName}님, BMI 분석을 위해 프로필에 키와 몸무게를 입력해주세요.\n\n대시보드에서 "건강 프로필 설정"을 통해 입력하실 수 있습니다.` + DISCLAIMER
    }
    
    let response = `${userName}님의 **BMI 상세 분석 리포트**입니다.\n\n`
    response += `📊 **BMI: ${bmiData.value} (${bmiData.category})**\n\n`
    response += `**글로벌 의료 가이드라인 기준:**\n`
    response += `• 저체중: 18.5 미만\n`
    response += `• 정상: 18.5 ~ 22.9\n`
    response += `• 과체중: 23 ~ 24.9\n`
    response += `• 비만 1단계: 25 ~ 29.9\n`
    response += `• 비만 2단계: 30 이상\n\n`
    response += `**맞춤 조언:** ${bmiData.advice}\n`
    
    return response + userContext + DISCLAIMER
  }
  
  // 인사/일반
  if (lowerMessage.includes('안녕') || lowerMessage.includes('하이') || lowerMessage.includes('hello')) {
    let response = `안녕하세요, ${userName}님! 👋\n\n`
    response += `글로벌 의료 가이드라인 기반의 **Dr. DOCENT** AI 건강 상담 서비스입니다.\n\n`
    
    if (bmiData) {
      response += `📊 현재 BMI: ${bmiData.value} (${bmiData.category})\n`
    }
    
    if (hasConditions) {
      response += `📋 등록된 기저 질환이 있어 맞춤 상담이 가능합니다.\n`
    }
    
    response += `\n궁금한 증상이나 건강 관련 질문이 있으시면 말씀해주세요!\n\n`
    response += `**상담 가능 주제:**\n`
    response += `• 증상 분석 (두통, 소화불량, 피로 등)\n`
    response += `• BMI 및 체중 관리\n`
    response += `• 운동/다이어트 조언\n`
    response += `• 기저 질환 고려 건강 상담\n`
    
    return response + DISCLAIMER
  }
  
  // 기본 응답 (질문을 반복하지 않음)
  let response = `${userName}님, 건강 상담을 도와드리겠습니다.\n\n`
  
  if (bmiData || hasConditions) {
    response += `**회원님의 건강 프로필을 기반으로 분석합니다:**\n\n`
    if (bmiData) {
      response += `• BMI: ${bmiData.value} (${bmiData.category})\n`
    }
    if (hasConditions) {
      response += `• 기저 질환: ${profile?.conditions}\n`
    }
    if (hasMedications) {
      response += `• 복용 약물: ${profile?.medications}\n`
    }
    response += `\n`
  }
  
  response += `더 정확한 분석을 위해 구체적인 증상을 말씀해주세요.\n\n`
  response += `**예시 질문:**\n`
  response += `• "요즘 두통이 심해요"\n`
  response += `• "피로감이 안 풀려요"\n`
  response += `• "다이어트 방법 추천해주세요"\n`
  response += `• "제 BMI가 어떤가요?"\n`
  
  return response + DISCLAIMER
}

// ========================
// 📋 유저 컨텍스트 빌더
// ========================
function buildUserContext(profile: UserProfile, bmiData: ReturnType<typeof calculateBMI>): string {
  let context = '\n\n---\n📋 **회원 건강 프로필 요약**\n'
  
  if (profile.age) context += `• 연령: ${profile.age}세\n`
  if (profile.gender) context += `• 성별: ${profile.gender === 'male' ? '남성' : '여성'}\n`
  if (profile.height && profile.weight) {
    context += `• 신체: ${profile.height}cm / ${profile.weight}kg\n`
  }
  if (bmiData) {
    context += `• BMI: ${bmiData.value} (${bmiData.category})\n`
  }
  if (profile.conditions) {
    context += `• 기저 질환: ${profile.conditions}\n`
  }
  if (profile.medications) {
    context += `• 복용 약물: ${profile.medications}\n`
  }
  
  return context
}

// ========================
// 🔢 일일 사용량 체크
// ========================
async function checkDailyLimit(supabase: ReturnType<typeof createServerClient>, userId: string): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]
  
  // chat_usage 테이블에서 오늘 사용량 조회
  const { data, error } = await supabase
    .from('chat_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('사용량 조회 에러:', error)
    // 에러 시 허용 (테이블이 없을 수 있음)
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
    // upsert로 카운트 증가
    const { error } = await supabase
      .from('chat_usage')
      .upsert({
        user_id: userId,
        date: today,
        count: 1
      }, {
        onConflict: 'user_id,date'
      })
    
    if (error) {
      console.error('사용량 증가 에러:', error)
    }
  } catch (e) {
    // 테이블이 없어도 무시
    console.log('사용량 추적 스킵 (테이블 없음)')
  }
}

// ========================
// 🚀 메인 API 핸들러
// ========================
export async function POST(req: Request) {
  console.log('🔄 [Chat API] 요청 수신')
  
  try {
    // 1️⃣ 요청 본문 파싱
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('❌ [Chat API] JSON 파싱 실패:', parseError)
      return NextResponse.json(
        { error: 'JSON 형식이 올바르지 않습니다' }, 
        { status: 400 }
      )
    }
    
    const { message } = body
    console.log('📩 [Chat API] 메시지:', message)

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: '메시지가 필요합니다' }, 
        { status: 400 }
      )
    }

    // 2️⃣ Supabase 클라이언트 생성
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Route Handler에서 쿠키 설정 실패 시 무시
            }
          },
        },
      }
    )

    // 3️⃣ 세션 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ [Chat API] 인증 실패:', authError?.message)
      return NextResponse.json(
        { error: '로그인이 필요합니다' }, 
        { status: 401 }
      )
    }
    
    console.log('👤 [Chat API] 사용자 ID:', user.id)

    // 4️⃣ 일일 사용량 체크
    const { allowed, count } = await checkDailyLimit(supabase, user.id)
    
    if (!allowed) {
      console.log('⚠️ [Chat API] 일일 제한 초과:', count)
      return NextResponse.json({
        error: `일일 사용 제한(${DAILY_LIMIT}회)을 초과했습니다. 내일 다시 이용해주세요.`,
        dailyLimit: true,
        count: count
      }, { status: 429 })
    }

    // 5️⃣ 유저 프로필 로드
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('age, gender, height, weight, conditions, medications')
      .eq('id', user.id)
      .single()
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ [Chat API] 프로필 조회 에러:', profileError)
    }
    
    console.log('📋 [Chat API] 프로필 로드:', profile ? '성공' : '없음')

    // 6️⃣ 사용자 이름 추출
    const userName = 
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      user.email?.split('@')[0] || 
      '고객'

    // 7️⃣ AI 응답 생성 (글로벌 의료 가이드라인 기반)
    const reply = generateAIResponse(message, userName, profile)
    
    // 8️⃣ 사용량 증가 (백그라운드)
    incrementUsage(supabase, user.id).catch(console.error)
    
    console.log('✅ [Chat API] 응답 생성 완료')
    
    return NextResponse.json({ 
      reply,
      usage: {
        count: count + 1,
        limit: DAILY_LIMIT,
        remaining: DAILY_LIMIT - count - 1
      }
    })
    
  } catch (error) {
    console.error('❌ [Chat API] 서버 에러:', error)
    
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}
