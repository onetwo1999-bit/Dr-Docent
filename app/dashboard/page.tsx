import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '../components/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 로그인 안 했으면 메인으로 리다이렉트
  if (!user) {
    redirect('/')
  }

  // 유저 정보에서 이름 또는 이메일 추출
  const displayName = user.user_metadata?.full_name 
    || user.user_metadata?.name 
    || user.email 
    || '사용자'

  return (
    <div className="min-h-screen bg-[#008080] text-white flex flex-col items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 w-full max-w-md border border-white/20 text-center">
        {/* 환영 메시지 */}
        <h1 className="text-3xl font-bold mb-4">
          환영합니다! 🎉
        </h1>
        <p className="text-xl text-[#40E0D0] font-semibold mb-2">
          {displayName}님
        </p>
        <p className="text-white/70 mb-8">
          닥터 도슨 대시보드에 오신 것을 환영합니다.
        </p>

        {/* 유저 정보 카드 */}
        <div className="bg-white/5 rounded-xl p-4 mb-8 text-left">
          <p className="text-sm text-white/50 mb-1">로그인 정보</p>
          <p className="text-white/90 text-sm break-all">
            {user.email || '이메일 없음'}
          </p>
          <p className="text-xs text-white/40 mt-2">
            가입일: {new Date(user.created_at).toLocaleDateString('ko-KR')}
          </p>
        </div>

        {/* 로그아웃 버튼 */}
        <LogoutButton />
      </div>
    </div>
  )
}
