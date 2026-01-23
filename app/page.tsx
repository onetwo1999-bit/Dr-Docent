import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LandingPage from './components/LandingPage'

export default async function HomePage() {
  // 서버에서 유저 확인
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ✅ 로그인된 유저는 즉시 대시보드로 리다이렉트
  if (user) {
    redirect('/dashboard')
  }

  // 로그인 안 된 유저는 랜딩 페이지 표시
  return <LandingPage />
}
