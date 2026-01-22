import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    // 1. 리다이렉트 응답 객체를 먼저 만듭니다.
    const response = NextResponse.redirect(`${origin}${next}`)

    // 2. 수파베이스 클라이언트를 응답 객체와 연결합니다.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            // 🚨 핵심: 발행된 티켓을 리다이렉트 응답에 직접 심습니다.
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      console.log('✅ [성공] 티켓 발행 완료, 메인으로 안전하게 전달합니다.')
      return response // 티켓이 심어진 응답을 반환합니다.
    }
    
    console.error('❌ [실패] 세션 교환 에러:', error?.message)
  }

  return NextResponse.redirect(`${origin}`)
}