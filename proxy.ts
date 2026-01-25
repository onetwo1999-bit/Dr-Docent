// proxy.ts - Supabase 세션 안정화 + HTTPS 환경 최적화
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 🔒 HTTPS 환경 감지
function isSecureEnvironment(request: NextRequest): boolean {
  // Vercel/프로덕션 환경
  if (process.env.VERCEL === '1') return true
  if (process.env.NODE_ENV === 'production') return true
  
  // X-Forwarded-Proto 헤더 체크 (프록시 뒤에서 실행 시)
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto === 'https') return true
  
  // URL 스키마 체크
  return request.nextUrl.protocol === 'https:'
}

// 🍪 쿠키 옵션 생성
function getCookieOptions(isSecure: boolean, options?: CookieOptions): CookieOptions {
  return {
    ...options,
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax', // HTTPS에서는 cross-site 허용
    httpOnly: true,
    path: '/',
  }
}

export async function proxy(request: NextRequest) {
  const isSecure = isSecureEnvironment(request)
  const pathname = request.nextUrl.pathname
  
  console.log(`🔐 [Proxy] 환경: ${isSecure ? 'HTTPS (Secure)' : 'HTTP (Dev)'}, 경로: ${pathname}`)

  // 응답 객체 생성
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Supabase 클라이언트 생성 (Secure 쿠키 옵션 포함)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 요청 헤더에 쿠키 설정
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          
          // 응답 재생성 (쿠키 반영)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          // 응답 헤더에 쿠키 설정 (Secure 옵션 적용)
          cookiesToSet.forEach(({ name, value, options }) => {
            const secureOptions = getCookieOptions(isSecure, options)
            response.cookies.set(name, value, secureOptions)
          })
        },
      },
    }
  )

  // 🔄 세션 갱신 시도 (핵심!)
  // getUser()를 호출하면 자동으로 토큰 갱신됨
  const { data: { user }, error } = await supabase.auth.getUser()

  // 🔀 리다이렉트 루프 방지: 이미 홈에 있으면 추가 처리 안함
  if (pathname === '/') {
    return response
  }

  // 보호된 경로 체크
  const isProtectedRoute = pathname.startsWith('/chat') ||
                           pathname.startsWith('/dashboard') ||
                           pathname.startsWith('/profile')
  
  const isAuthRoute = pathname.startsWith('/auth')
  const isCallbackRoute = pathname.includes('/callback')

  // 🛡️ 보호된 경로에서 유저가 없으면 → 홈으로 리다이렉트
  if (isProtectedRoute) {
    if (!user) {
      // 세션 만료 또는 명확한 인증 실패 시만 리다이렉트
      const shouldRedirect = !error || 
        error.message?.includes('expired') || 
        error.message?.includes('invalid') ||
        error.message?.includes('not authenticated')
      
      if (shouldRedirect) {
        console.log('🚫 [Proxy] 인증 필요 - 홈으로 리다이렉트')
        const redirectUrl = new URL('/', request.url)
        // 리다이렉트 루프 방지용 파라미터
        redirectUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(redirectUrl)
      }
      
      // 일시적 네트워크 에러면 통과 (페이지에서 재확인)
      console.log('⚠️ [Proxy] 인증 확인 실패 (일시적) - 통과')
    } else {
      console.log(`✅ [Proxy] 인증 확인 완료: ${user.email}`)
    }
  }

  // 🔀 이미 로그인된 유저가 auth 경로 접근 시 → dashboard로
  // 단, callback 경로는 제외 (OAuth 플로우 진행 중)
  if (isAuthRoute && user && !isCallbackRoute) {
    console.log('🔀 [Proxy] 이미 로그인됨 - 대시보드로 리다이렉트')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // 정적 파일, 이미지 제외
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
