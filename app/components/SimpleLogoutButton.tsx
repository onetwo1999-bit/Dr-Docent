'use client'

import { useState } from 'react'

export default function SimpleLogoutButton() {
  const [status, setStatus] = useState('대기')

  const handleClick = () => {
    setStatus('클릭됨!')
    console.log('🔴 버튼 클릭됨!')
    
    // 1초 후 로그아웃 실행
    setTimeout(() => {
      setStatus('로그아웃 중...')
      
      // 쿠키 삭제
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim()
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        }
      })
      
      // 이동
      window.location.href = '/'
    }, 500)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        width: '100%',
        padding: '12px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold'
      }}
    >
      로그아웃 ({status})
    </button>
  )
}
