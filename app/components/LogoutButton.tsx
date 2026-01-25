'use client'

import { LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    if (isLoading) return
    
    setIsLoading(true)
    console.log('🔄 [LogoutButton] 로그아웃 시작...')
    
    try {
      // 1️⃣ 동적으로 Supabase 클라이언트 생성 (환경 변수 문제 방지)
      const { createBrowserClient } = await import('@supabase/ssr')
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('📋 [LogoutButton] Supabase URL:', supabaseUrl ? '있음' : '없음')
      console.log('📋 [LogoutButton] Supabase Key:', supabaseKey ? '있음' : '없음')
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ [LogoutButton] 환경 변수 누락!')
        // 환경 변수 없어도 쿠키 삭제하고 이동
        clearAllCookies()
        window.location.href = '/'
        return
      }
      
      const supabase = createBrowserClient(supabaseUrl, supabaseKey)
      
      // 2️⃣ Supabase 세션 종료
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ [LogoutButton] signOut 에러:', error.message)
      } else {
        console.log('✅ [LogoutButton] Supabase 세션 종료 완료')
      }
      
      // 3️⃣ 브라우저 쿠키 수동 삭제
      clearAllCookies()
      
      // 4️⃣ 메인 페이지로 강제 이동
      console.log('🏠 [LogoutButton] 메인으로 이동...')
      window.location.href = '/'
      
    } catch (err) {
      console.error('❌ [LogoutButton] 예외 발생:', err)
      // 에러가 발생해도 쿠키 삭제하고 이동
      clearAllCookies()
      window.location.href = '/'
    }
  }
  
  // 쿠키 삭제 함수
  const clearAllCookies = () => {
    console.log('🗑️ [LogoutButton] 쿠키 삭제 시작...')
    
    document.cookie.split(';').forEach(cookie => {
      const cookieName = cookie.split('=')[0].trim()
      if (cookieName.startsWith('sb-') || cookieName.includes('supabase')) {
        // 다양한 path와 domain 조합으로 삭제 시도
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
        console.log(`   🗑️ 삭제: ${cookieName}`)
      }
    })
    
    console.log('✅ [LogoutButton] 쿠키 삭제 완료')
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-500 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-gray-200"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-[#2DD4BF]" />
          로그아웃 중...
        </>
      ) : (
        <>
          <LogOut className="w-5 h-5 text-[#2DD4BF]" />
          로그아웃
        </>
      )}
    </button>
  )
}
