import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    // 💡 리다이렉트 응답 객체를 먼저 만듭니다.
    const response = NextResponse.redirect(`${origin}/chat`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // 💡 [핵심] 서버 저장소와 리다이렉트 응답 양쪽에 티켓을 강제로 박아넣습니다.
              cookieStore.set(name, value, { ...options, path: '/', secure: false })
              response.cookies.set(name, value, { ...options, path: '/', secure: false })
            })
          },
        },
      }
    )
    
    // 이 과정에서 auth-token이 생성되어 response에 담깁니다.
    await supabase.auth.exchangeCodeForSession(code)
    return response
  }

  return NextResponse.redirect(`${origin}/?error=no_code`)
}