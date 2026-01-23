'use client'

export default function LogoutSection() {
  const handleLogout = () => {
    // 알림으로 클릭 확인
    alert('로그아웃 버튼이 클릭되었습니다!')
    
    console.log('🔴 로그아웃 시작!')
    
    // 쿠키 삭제
    const cookies = document.cookie.split(';')
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim()
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    })
    
    console.log('✅ 쿠키 삭제 완료')
    
    // 메인으로 이동
    window.location.href = '/'
  }

  return (
    <div className="space-y-2">
      {/* 메인 로그아웃 버튼 */}
      <button
        onClick={handleLogout}
        className="w-full bg-white/20 hover:bg-white/30 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        🚪 로그아웃
      </button>
      
      {/* 테스트용 a 태그 (버튼이 안 될 경우) */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault()
          alert('a 태그 클릭됨!')
          // 쿠키 삭제
          document.cookie.split(';').forEach(c => {
            const name = c.split('=')[0].trim()
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          })
          window.location.href = '/'
        }}
        className="block w-full bg-red-500/50 hover:bg-red-500/70 text-white py-3 rounded-xl font-semibold text-center cursor-pointer"
      >
        🔴 로그아웃 (테스트)
      </a>
    </div>
  )
}
