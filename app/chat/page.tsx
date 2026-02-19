import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ChatInterface from './ChatInterface'

export default async function ChatPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // profiles.nickname 조회 (Realtime 초기값)
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .single()

  const initialNickname = (profile as { nickname?: string | null } | null)?.nickname ?? null
  const emailPrefix = user.email?.split('@')[0] || '사용자'

  return (
    <ChatInterface
      userId={user.id}
      initialNickname={initialNickname}
      emailPrefix={emailPrefix}
    />
  )
}
