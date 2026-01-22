import { NextResponse } from 'next/server'
// 1세트에서 만든 파일을 불러옵니다.
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // 로그인 성공 후 메인 페이지로 보냅니다.
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    // 인증 코드를 세션으로 교환합니다.
    // 이 과정이 성공해야 브라우저 주머니에 진짜 티켓이 들어옵니다.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 에러 발생 시 메인 페이지로 돌려보냅니다.
  return NextResponse.redirect(`${origin}`)
}