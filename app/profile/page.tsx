import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '../components/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // 현재 프로필 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('age, gender, height, weight, conditions, medications')
    .eq('id', user.id)
    .single()

  const displayName = 
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.identities?.[0]?.identity_data?.nickname ||
    '사용자'

  return (
    <div className="min-h-screen bg-[#008080] text-white flex flex-col items-center justify-center p-6">
      <ProfileForm 
        userId={user.id} 
        userName={displayName} 
        initialProfile={profile}
      />
    </div>
  )
}
