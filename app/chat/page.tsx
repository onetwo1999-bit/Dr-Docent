import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ChatInterface from './ChatInterface'

export default async function ChatPage() {
  const supabase = await createClient()
  
  // 🚨 로그인 체크: 로그인 안 했으면 메인으로 리다이렉트
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }

  // 유저 이름 추출
  const userName = user.user_metadata?.full_name 
    || user.user_metadata?.name 
    || user.email 
    || '사용자'

  return <ChatInterface userName={userName} />
}
