'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function AuthDebugger() {
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  
  // 💡 설정된 환경 변수를 직접 확인합니다.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '설정 안 됨'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '설정 완료' : '설정 안 됨'

  const supabase = createBrowserClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const addLog = (msg: string) => setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])

  const runInspection = async () => {
    setDebugLogs([])
    addLog("🔍 점검 시작...")
    addLog(`📍 설정된 Supabase URL: ${supabaseUrl}`)

    // 1. 브라우저가 직접 접근 가능한 쿠키 전체 출력
    addLog(`🍪 현재 브라우저 쿠키 목록: ${document.cookie || '없음(JS 접근 불가)'}`)

    // 2. Supabase 세션 확인 (getSession)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (session) {
      addLog(`✅ getSession 성공! 유저 ID: ${session.user.id}`)
    } else {
      addLog(`❌ getSession 실패: ${sessionError?.message || '세션 없음'}`)
    }

    // 3. Supabase 유저 확인 (getUser)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (user) {
      addLog(`✅ getUser 성공! 이메일: ${user.email}`)
    } else {
      addLog(`❌ getUser 실패: ${userError?.message || '유저 정보 없음'}`)
    }
  }

  useEffect(() => { runInspection() }, [])

  return (
    <div className="p-10 bg-black text-green-400 font-mono h-screen overflow-y-auto">
      <h1 className="text-2xl font-bold mb-5">🚨 닥터 도슨 쿠키 점검 모드</h1>
      <div className="mb-5 p-4 border border-green-800 bg-gray-900 rounded">
        <p>URL 일치 확인: {supabaseUrl.includes('fddoizheudxxqescjpbq') ? '✅ 일치' : '❌ 불일치 (쿠키와 다름)'}</p>
        <p>Key 설정: {supabaseKey}</p>
      </div>
      <button onClick={runInspection} className="bg-green-700 text-white px-6 py-2 rounded mb-5 hover:bg-green-600">다시 점검</button>
      <div className="space-y-2">
        {debugLogs.map((log, i) => <p key={i}>{log}</p>)}
      </div>
    </div>
  )
}