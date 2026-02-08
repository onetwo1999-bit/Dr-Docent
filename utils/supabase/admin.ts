import { createClient } from '@supabase/supabase-js'

/**
 * service_role 키로 RLS를 우회하는 Supabase 클라이언트.
 * 서버 전용 (API routes, 백그라운드 작업).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  }
  return createClient(url, key)
}
