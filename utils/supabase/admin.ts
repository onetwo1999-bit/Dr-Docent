import { createClient } from '@supabase/supabase-js'

/**
 * service_role 키로 RLS를 우회하는 Supabase 클라이언트.
 * 서버 전용 (API routes, Server Actions, 백그라운드 작업).
 *
 * 보안: SUPABASE_SERVICE_ROLE_KEY는 NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에 노출되지 않음.
 * 이 파일은 app/api/*, lib/* (서버에서만 호출)에서만 import해야 하며, 'use client' 컴포넌트에서는 사용 금지.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요. (Vercel: Project → Settings → Environment Variables에 두 키 모두 등록 후 재배포)'
    )
  }
  return createClient(url, key)
}
