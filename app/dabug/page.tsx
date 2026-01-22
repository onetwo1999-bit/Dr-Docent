'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/server' // 주의: 클라이언트용으로 수정 필요

export default function DebugPage() {
  const [status, setStatus] = useState<any[]>([])

  const log = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatus(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }])
  }

  useEffect(() => {
    async function checkAuth() {
      log('🔍 실전 배포 환경 정밀 점검 시작...')

      // 1. 환경 변수 체크
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (url) log(`✅ Supabase URL 연결됨: ${url.substring(0, 20)}...`, 'success')
      else log('❌ Supabase URL이 비어있습니다. Vercel 설정을 확인하세요.', 'error')

      // 2. 쿠키 체크
      const allCookies = document.cookie
      log(`🍪 현재 브라우저 쿠키: ${allCookies || '없음'}`)
      
      if (allCookies.includes('sb-')) log('✅ 수파베이스 인증 쿠키 발견!', 'success')
      else log('❓ 인증 쿠키가 보이지 않습니다. 브라우저가 삭제했을 가능성이 큼.', 'error')

      // 3. 실제 세션 체크 (가장 중요)
      try {
        const { data: { session }, error } = await (await import('@/utils/supabase/server')).createClient().auth.getSession()
        if (session) log(`🎉 세션 연결 성공! 유저 ID: ${session.user.id}`, 'success')
        else log('❌ 세션 데이터가 없습니다. 다시 로그인하세요.', 'error')
      } catch (e) {
        log(`🚨 오류 발생: ${JSON.stringify(e)}`, 'error')
      }
    }

    checkAuth()
  }, [])

  return (
    <div style={{ backgroundColor: '#000', color: '#0f0', padding: '20px', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h1>🚨 닥터 도슨 배포 점검 시스템</h1>
      <button onClick={() => window.location.reload()} style={{ padding: '10px', marginBottom: '20px' }}>다시 점검</button>
      <div style={{ border: '1px solid #0f0', padding: '10px' }}>
        {status.map((s, i) => (
          <div key={i} style={{ color: s.type === 'error' ? 'red' : s.type === 'success' ? '#0f0' : '#fff', marginBottom: '5px' }}>
            [{s.time}] {s.msg}
          </div>
        ))}
      </div>
    </div>
  )
}