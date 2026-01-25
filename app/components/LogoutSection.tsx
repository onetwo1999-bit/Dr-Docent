import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { LogOut } from 'lucide-react'

// Server Action - JavaScript 없이도 작동
async function handleLogout() {
  'use server'
  
  console.log('🔄 [Server Action] 로그아웃 시작')
  
  try {
    // 1. Supabase 세션 종료
    const supabase = await createClient()
    await supabase.auth.signOut()
    console.log('✅ [Server Action] Supabase 세션 종료')
  } catch (error) {
    console.error('❌ [Server Action] Supabase 에러:', error)
  }
  
  // 2. 모든 sb- 쿠키 삭제
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    for (const cookie of allCookies) {
      if (cookie.name.startsWith('sb-')) {
        cookieStore.delete(cookie.name)
        console.log(`🗑️ [Server Action] 쿠키 삭제: ${cookie.name}`)
      }
    }
  } catch (error) {
    console.error('❌ [Server Action] 쿠키 삭제 에러:', error)
  }
  
  console.log('🏠 [Server Action] 메인으로 리다이렉트')
  
  // 3. 메인으로 리다이렉트
  redirect('/')
}

export default function LogoutSection() {
  return (
    <form action={handleLogout}>
      <button
        type="submit"
        className="w-full bg-white hover:bg-gray-50 text-gray-500 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-gray-200"
      >
        <LogOut className="w-5 h-5 text-[#2DD4BF]" />
        로그아웃
      </button>
    </form>
  )
}
