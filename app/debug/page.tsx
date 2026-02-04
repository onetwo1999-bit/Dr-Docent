'use client'
import { useEffect, useState } from 'react'

export default function DebugPage() {
  const [info, setInfo] = useState<string[]>([])

  useEffect(() => {
    const check = () => {
      const logs = []
      logs.push(`📍 현재 주소: ${window.location.href}`)
      logs.push(`🍪 브라우저 쿠키: ${document.cookie || '없음'}`)
      logs.push(`🌐 환경변수 URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '비어있음'}`)
      setInfo(logs)
    }
    check()
  }, [])

  return (
    <div style={{ padding: '20px', background: '#000', color: '#0f0', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1>🚨 닥터 도슨 긴급 점검</h1>
      {info.map((line, i) => <p key={i}>{line}</p>)}
      <button onClick={() => window.location.href = '/'} style={{ background: '#0f0', color: '#000', padding: '10px' }}>메인으로 가기</button>
    </div>
  )
}