import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() { // 1. async 추가
  const cookieStore = await cookies() // 2. 🚨 반드시 await를 붙여야 합니다!

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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트 에러 무시
          }
        },
      },
    }
  )
}