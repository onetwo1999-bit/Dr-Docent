'use client'

import { createBrowserClient } from '@supabase/ssr'
import { LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogout = async () => {
    setIsLoading(true)
    
    try {
      console.log('🔄 로그아웃 시작...')
      
      // 1️⃣ Supabase 세션 종료
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ 로그아웃 에러:', error.message)
        alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.')
        setIsLoading(false)
        return
      }
      
      console.log('✅ Supabase 세션 종료 완료')
      
      // 2️⃣ 브라우저 쿠키 수동 삭제 (sb- 로 시작하는 모든 쿠키)
      document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim()
        if (cookieName.startsWith('sb-')) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          console.log(`🗑️ 쿠키 삭제: ${cookieName}`)
        }
      })
      
      console.log('✅ 쿠키 삭제 완료')
      
      // 3️⃣ 전체 페이지 새로고침으로 메인 이동 (가장 확실한 방법)
      window.location.href = '/'
      
    } catch (err) {
      console.error('❌ 로그아웃 실패:', err)
      alert('로그아웃 중 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          로그아웃 중...
        </>
      ) : (
        <>
          <LogOut className="w-5 h-5" />
          로그아웃
        </>
      )}
    </button>
  )
}
