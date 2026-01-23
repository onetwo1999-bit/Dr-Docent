// my-app/proxy.ts (위치는 루트 폴더)

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server' // 🚨 server에서 가져오기

export async function middleware(request: NextRequest) { // 🚨 반드시 middleware여야 작동합니다!
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 🚨 이 부분이 실행되어야 브라우저 쿠키를 세션으로 전환합니다.
  await supabase.auth.getUser() 

  return response
}

export const config = {
  // 모든 경로에서 미들웨어가 작동하도록 설정 (이미지/파비콘 제외)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}