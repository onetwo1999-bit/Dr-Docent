import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

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
      console.error('❌ [Chat API] 메시지가 없음')
      return NextResponse.json(
        { error: '메시지가 필요합니다' }, 
        { status: 400 }
      )
    }

    // 2️⃣ 세션 확인
    let user = null
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('❌ [Chat API] 세션 조회 에러:', error.message)
      } else {
        user = data.user
      }
    } catch (authError) {
      console.error('❌ [Chat API] 인증 처리 에러:', authError)
      // 인증 에러가 발생해도 계속 진행 (비로그인 사용자도 테스트 가능)
    }
    
    // 로그인 필수로 하려면 아래 주석 해제
    // if (!user) {
    //   console.error('❌ [Chat API] 인증되지 않은 사용자')
    //   return NextResponse.json(
    //     { error: '로그인이 필요합니다' }, 
    //     { status: 401 }
    //   )
    // }
    
    const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || '고객'
    console.log('👤 [Chat API] 사용자:', userName)

    // 3️⃣ AI 응답 생성 (테스트용)
    const reply = generateTestResponse(message, userName)
    
    console.log('✅ [Chat API] 응답 생성 완료')
    
    return NextResponse.json({ reply })
    
  } catch (error) {
    console.error('❌ [Chat API] 서버 에러:', error)
    
    // 에러 상세 정보 로깅
    if (error instanceof Error) {
      console.error('   - 에러 이름:', error.name)
      console.error('   - 에러 메시지:', error.message)
      console.error('   - 스택:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}

// 테스트용 응답 생성 함수
function generateTestResponse(message: string, userName: string): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('두통') || lowerMessage.includes('머리')) {
    return `${userName}님, 두통이 있으시군요. 😔\n\n충분한 수분 섭취와 휴식을 취해보세요. 증상이 3일 이상 지속되면 전문의 상담을 권장드립니다.`
  }
  
  if (lowerMessage.includes('감기') || lowerMessage.includes('기침') || lowerMessage.includes('콧물')) {
    return `${userName}님, 감기 증상이 있으시네요. 🤧\n\n따뜻한 물을 자주 마시고, 충분한 휴식을 취하세요. 고열이나 호흡곤란이 있다면 병원 방문을 권장드립니다.`
  }
  
  if (lowerMessage.includes('피곤') || lowerMessage.includes('피로') || lowerMessage.includes('졸려')) {
    return `${userName}님, 피로감을 느끼고 계시군요. 😴\n\n규칙적인 수면, 균형 잡힌 식사, 가벼운 운동이 도움이 됩니다. 만성 피로가 지속된다면 건강검진을 고려해보세요.`
  }
  
  if (lowerMessage.includes('안녕') || lowerMessage.includes('하이') || lowerMessage.includes('hello')) {
    return `안녕하세요, ${userName}님! 👋\n\n오늘 건강 상태는 어떠신가요? 궁금한 증상이나 건강 관련 질문이 있으시면 편하게 말씀해주세요!`
  }
  
  return `${userName}님, 말씀하신 "${message}"에 대해 답변드릴게요.\n\n건강 관련 궁금한 점이 있으시면 구체적인 증상을 말씀해주시면 더 정확한 정보를 드릴 수 있어요.\n\n예시 질문:\n• "두통이 있어요"\n• "요즘 피곤해요"\n• "감기에 걸린 것 같아요"`
}
