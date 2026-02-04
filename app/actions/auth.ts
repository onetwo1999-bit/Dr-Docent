'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function signOut() {
  const supabase = await createClient()
  
  // 1️⃣ Supabase 세션 종료
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('❌ 서버 로그아웃 에러:', error.message)
  } else {
    console.log('✅ 서버 세션 종료 완료')
  }
  
  // 2️⃣ 서버에서 sb- 쿠키 직접 삭제
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name)
      console.log(`🗑️ 서버 쿠키 삭제: ${cookie.name}`)
    }
  }
  
  // 3️⃣ 메인 페이지로 리다이렉트
  redirect('/')
}
