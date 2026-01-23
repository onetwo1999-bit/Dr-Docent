import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '../components/LogoutButton'
import SimpleLogoutButton from '../components/SimpleLogoutButton'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

// 🔒 HTTP → HTTPS 변환 함수
function toSecureUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:\/\//i, 'https://')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 로그인 안 했으면 메인으로 리다이렉트
  if (!user) {
    redirect('/')
  }

  // 📧 이메일 추출 (여러 소스에서 확인)
  const email = 
    user.email ||
    user.user_metadata?.email ||
    user.identities?.[0]?.identity_data?.email ||
    null

  // 👤 이름 추출 (여러 소스에서 확인)
  const displayName = 
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.preferred_username ||
    user.identities?.[0]?.identity_data?.nickname ||
    email?.split('@')[0] ||
    '사용자'

  // 🖼️ 프로필 이미지 추출 + HTTPS 강제 변환
  const rawAvatarUrl = 
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    null
  
  const avatarUrl = toSecureUrl(rawAvatarUrl)

  // 🔍 카카오 계정 정보
  const kakaoIdentity = user.identities?.find(i => i.provider === 'kakao')
  const kakaoEmail = kakaoIdentity?.identity_data?.email
  const kakaoNickname = kakaoIdentity?.identity_data?.nickname

  return (
    <div className="min-h-screen bg-[#008080] text-white flex flex-col items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 w-full max-w-md border border-white/20 text-center">
        
        {/* 프로필 이미지 */}
        {avatarUrl && (
          <div className="mb-4">
            <img 
              src={avatarUrl} 
              alt="프로필" 
              className="w-20 h-20 rounded-full mx-auto border-2 border-[#40E0D0] object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* 환영 메시지 */}
        <h1 className="text-3xl font-bold mb-4">
          환영합니다! 🎉
        </h1>
        <p className="text-xl text-[#40E0D0] font-semibold mb-2">
          {displayName}님
        </p>
        <p className="text-white/70 mb-6">
          닥터 도슨 대시보드에 오신 것을 환영합니다.
        </p>

        {/* 유저 정보 카드 */}
        <div className="bg-white/5 rounded-xl p-4 mb-6 text-left space-y-3">
          <div>
            <p className="text-xs text-white/50">이메일</p>
            <p className="text-white/90 text-sm break-all">
              {email || '이메일 정보 없음'}
            </p>
          </div>
          
          {kakaoNickname && (
            <div>
              <p className="text-xs text-white/50">카카오 닉네임</p>
              <p className="text-white/90 text-sm">{kakaoNickname}</p>
            </div>
          )}

          {kakaoEmail && kakaoEmail !== email && (
            <div>
              <p className="text-xs text-white/50">카카오 이메일</p>
              <p className="text-white/90 text-sm break-all">{kakaoEmail}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-white/50">가입일</p>
            <p className="text-white/90 text-sm">
              {new Date(user.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div>
            <p className="text-xs text-white/50">로그인 방식</p>
            <p className="text-white/90 text-sm">
              {kakaoIdentity ? '카카오 계정' : user.app_metadata?.provider || '이메일'}
            </p>
          </div>
        </div>

        {/* 채팅 바로가기 버튼 */}
        <Link 
          href="/chat"
          className="w-full bg-[#40E0D0] hover:bg-[#3BC9BB] text-[#008080] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors mb-3"
        >
          <MessageSquare className="w-5 h-5" />
          AI 건강 상담 시작하기
        </Link>

        {/* 로그아웃 버튼 (테스트용 - 두 가지) */}
        <div className="space-y-2">
          <LogoutButton />
          <SimpleLogoutButton />
        </div>
      </div>
    </div>
  )
}
