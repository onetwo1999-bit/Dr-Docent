import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// 🔒 퍼스트 파티 쿠키 옵션 (Chrome Bounce Tracking 우회)
const COOKIE_OPTIONS = {
  sameSite: 'lax' as const,    // 퍼스트 파티로 인식되도록 lax 사용
  secure: true,                 // HTTPS 전용 (Vercel은 기본 HTTPS)
  httpOnly: true,               // JavaScript 접근 차단 (XSS 방지)
  path: '/',                    // 전체 사이트에서 유효
  maxAge: 60 * 60 * 24 * 7,    // 7일간 유지 (세션 지속성)
  // ⚠️ domain은 명시하지 않음 → 브라우저가 자동으로 현재 앱 도메인으로 설정
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard' // 성공 시 대시보드로

  if (!code) {
    console.error('❌ 인증 코드가 없습니다')
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  const cookieStore = await cookies()
  
  // 1️⃣ 리다이렉트 응답 객체 생성 (쿠키를 이 응답에 심음)
  const response = NextResponse.redirect(`${origin}${next}`)

  // 2️⃣ Supabase 클라이언트 생성 - 쿠키가 "앱 도메인"에 저장되도록 설정
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // 🔑 핵심: 쿠키를 Supabase 도메인이 아닌 "앱 도메인"에 저장
          cookiesToSet.forEach(({ name, value, options }) => {
            // 기존 옵션 무시하고 퍼스트 파티 옵션으로 덮어쓰기
            response.cookies.set(name, value, {
              ...COOKIE_OPTIONS,
              // maxAge는 Supabase가 제공하는 값 사용 (세션 만료 시간)
              maxAge: options?.maxAge ?? COOKIE_OPTIONS.maxAge,
            })
          })
        },
      },
    }
  )

  // 3️⃣ PKCE 흐름: 코드를 세션으로 교환
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('❌ 세션 교환 실패:', error.message)
    return NextResponse.redirect(`${origin}/?error=exchange_failed`)
  }

  if (data.session) {
    console.log('✅ 퍼스트 파티 쿠키로 세션 저장 완료!')
    console.log('   - 사용자:', data.session.user.email)
    console.log('   - 도메인:', new URL(origin).hostname)
    return response // 쿠키가 포함된 응답 반환
  }

  return NextResponse.redirect(`${origin}/?error=no_session`)
}
