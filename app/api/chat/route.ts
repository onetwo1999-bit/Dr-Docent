import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { message, userProfile } = await req.json()

    // 💡 [테스트용 답변] 챗봇의 입을 열기 위한 임시 코드입니다.
    const reply = `${userProfile.age || '고객'}님, 입력하신 정보와 "${message}"라는 증상을 보니 목 감기 초기 증세로 보입니다. 따뜻한 물을 자주 마시고 휴식을 취해보시는 건 어떨까요?`

    return NextResponse.json({ reply })
  } catch (error) {
    return NextResponse.json({ error: '서버 에러' }, { status: 500 })
  }
}