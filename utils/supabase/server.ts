import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 🚨 함수 앞에 async를 붙여 비동기로 만듭니다.
export async function createClient() {
  // 🚨 cookies() 앞에 await를 추가합니다.
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