import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
// ... 기존 임포트

export default async function Home() {
  const supabase = await createClient()
  
  // 🚨 이 부분이 있어야 쿠키를 확인하고 대시보드로 보냅니다!
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard')
  }

  return (
    // ... 기존 랜딩 페이지 JSX 코드
  )
}