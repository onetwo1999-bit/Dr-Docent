import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저(클라이언트)용 Supabase 클라이언트 생성
 * 
 * 사용법:
 * - 'use client' 컴포넌트에서만 사용
 * - 서버 컴포넌트에서는 utils/supabase/server.ts의 createClient 사용
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
