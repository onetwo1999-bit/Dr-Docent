import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// 🌐 배포 도메인 설정
const PRODUCTION_DOMAIN = 'dr-docent.vercel.app'

// 🔒 퍼스트 파티 쿠키 옵션 생성 함수
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  return {
    sameSite: 'lax' as const,
    secure: true,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,        // 7일 유지
    // ⚠️ 로컬에서는 domain 생략, 프로덕션에서만 명시적 설정
    ...(isProduction && { domain: PRODUCTION_DOMAIN }),
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    console.error('❌ 인증 코드가 없습니다')
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  const cookieStore = await cookies()
  const cookieOptions = getCookieOptions()
  
  // 1️⃣ 리다이렉트 응답 객체 생성
  const response = NextResponse.redirect(`${origin}${next}`)

  // 2️⃣ Supabase 클라이언트 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // 🔑 퍼스트 파티 쿠키 옵션 강제 적용
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...cookieOptions,
              maxAge: options?.maxAge ?? cookieOptions.maxAge,
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
    console.log('   - 도메인:', process.env.NODE_ENV === 'production' ? PRODUCTION_DOMAIN : 'localhost')
    return response
  }

  return NextResponse.redirect(`${origin}/?error=no_session`)
}
