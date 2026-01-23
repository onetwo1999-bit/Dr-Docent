import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 🌐 배포 도메인 설정
const PRODUCTION_DOMAIN = 'dr-docent.vercel.app'

// 🔒 퍼스트 파티 쿠키 옵션 생성 함수
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  return {
    sameSite: 'lax' as const,
    secure: true,                    // Vercel은 항상 HTTPS
    httpOnly: true,
    path: '/',
    // ⚠️ 로컬에서는 domain 생략, 프로덕션에서만 명시적 설정
    ...(isProduction && { domain: PRODUCTION_DOMAIN }),
  }
}

export async function createClient() {
  // ✅ Next.js 15+ 에서는 cookies()가 Promise를 반환하므로 await 필수!
  const cookieStore = await cookies()
  const cookieOptions = getCookieOptions()

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
            // 🔑 퍼스트 파티 쿠키 옵션 강제 적용
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...cookieOptions,
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
