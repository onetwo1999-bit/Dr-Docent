// 파일 위치: my-app/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 🔒 퍼스트 파티 쿠키 옵션 (Chrome Bounce Tracking 우회)
const COOKIE_OPTIONS = {
  sameSite: 'lax' as const,
  secure: true,
  httpOnly: true,
  path: '/',
}

// ✅ Next.js 16: proxy.ts 파일에서는 함수명도 'proxy'여야 합니다!
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Request 쿠키 업데이트 (다운스트림 서버 컴포넌트용)
          cookiesToSet.forEach(({ name, value }) => 
            request.cookies.set(name, value)
          )
          
          // 새 응답 객체 생성
          response = NextResponse.next({ request })
          
          // 🔑 퍼스트 파티 쿠키 옵션으로 응답에 쿠키 설정
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...COOKIE_OPTIONS,
              maxAge: options?.maxAge, // 세션 만료 시간 유지
            })
          )
        },
      },
    }
  )

  // 🔄 세션 갱신 - 매 요청마다 토큰 리프레시 (로그인 유지 핵심)
  await supabase.auth.getUser()

  return response
}

export const config = {
  // 정적 파일 제외한 모든 경로에서 실행
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
