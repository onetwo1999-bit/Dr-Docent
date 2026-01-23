import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            // 🔒 Chrome Bounce Tracking 우회를 위한 쿠키 설정 강화
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                // Chrome의 third-party cookie 차단 우회
                sameSite: 'lax',        // 'none' 대신 'lax' 사용 (더 안전)
                secure: true,            // HTTPS 필수
                httpOnly: true,          // XSS 방지
                path: '/',               // 전체 사이트에서 접근 가능
              })
            })
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      console.log('✅ 세션 생성 성공! 사용자:', data.session.user.email)
      return response
    }
    
    console.error('❌ 세션 교환 실패:', error?.message)
  }

  // 실패 시 홈으로 리다이렉트
  return NextResponse.redirect(`${origin}`)
}
