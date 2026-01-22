import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 🚨 중요: createServerClient와 supabase.auth.getUser() 사이에
  // 다른 로직을 넣지 마세요. 세션 동기화 문제가 발생할 수 있습니다.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 보호된 경로 예시 (필요시 주석 해제)
  // if (
  //   !user &&
  //   !request.nextUrl.pathname.startsWith('/login') &&
  //   !request.nextUrl.pathname.startsWith('/auth')
  // ) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login'
  //   return NextResponse.redirect(url)
  // }

  // 🚨 중요: 반드시 supabaseResponse를 반환해야 합니다.
  // 새로운 응답 객체를 만들 경우:
  // 1. const newResponse = NextResponse.next({ request })
  // 2. newResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. return newResponse
  // 이렇게 하지 않으면 브라우저와 서버의 세션이 동기화되지 않습니다.

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 다음으로 시작하는 경로를 제외한 모든 요청 경로와 매칭:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico (파비콘)
     * - 이미지 파일들 (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
