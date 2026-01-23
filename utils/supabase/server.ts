import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 🔒 퍼스트 파티 쿠키 옵션 (Chrome Bounce Tracking 우회)
const COOKIE_OPTIONS = {
  sameSite: 'lax' as const,
  secure: true,
  httpOnly: true,
  path: '/',
}

export async function createClient() {
  // ✅ Next.js 15+ 에서는 cookies()가 Promise를 반환하므로 await 필수!
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            // 🔑 퍼스트 파티 쿠키 옵션으로 설정
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...COOKIE_OPTIONS,
                maxAge: options?.maxAge, // 세션 만료 시간 유지
              })
            )
          } catch {
            // Server Component에서 쿠키 수정 시도 시 무시
            // (Middleware나 Route Handler에서만 쿠키 수정 가능)
          }
        },
      },
    }
  )
}
