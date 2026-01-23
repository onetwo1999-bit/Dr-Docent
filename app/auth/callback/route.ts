import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    // 1. 리다이렉트 응답 객체를 먼저 생성합니다.
    const response = NextResponse.redirect(`${origin}${next}`)

    // 2. 응답 객체에 쿠키를 직접 심어주는 클라이언트를 생성합니다.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            // 🚨 브라우저의 차단을 뚫기 위해 응답 헤더에 직접 쿠키를 구워 넣습니다.
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('✅ 쿠키 생성 성공! 이제 메인으로 이동합니다.')
      return response // 🚨 쿠키가 포함된 응답을 반환합니다.
    }
  }

  return NextResponse.redirect(`${origin}`)
}