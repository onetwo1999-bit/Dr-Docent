import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AdminTestClient from './AdminTestClient'

export default async function AdminTestPage() {
  const supabase = await createClient()
  
  // 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/')
  }

  // 프로필에서 role 확인
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 관리자가 아니면 접근 거부
  if (profileError || profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminTestClient userId={user.id} />
    </div>
  )
}
