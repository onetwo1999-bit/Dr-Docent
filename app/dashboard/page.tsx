import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Settings } from 'lucide-react'
import LogoutSection from '../components/LogoutSection'
import DashboardClient from '../components/DashboardClient'
import HealthSummary from '../components/HealthSummary'

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

  // 📊 profiles 테이블에서 사용자 데이터 조회
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('age, gender, height, weight, conditions, medications')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('프로필 조회 에러:', profileError)
  }

  // 📧 이메일 추출
  const email = 
    user.email ||
    user.user_metadata?.email ||
    user.identities?.[0]?.identity_data?.email ||
    null

  // 👤 이름 추출 (실제 이름)
  const realName = 
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.preferred_username ||
    user.identities?.[0]?.identity_data?.nickname ||
    email?.split('@')[0] ||
    '사용자'

  // 🏥 차트 번호 생성 (user.id 해시 기반 6자리)
  const chartNumber = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()
  
  // 📋 대시보드용 호칭: "차트 #XXXXXX 회원님"
  const displayName = `차트 #${chartNumber} 회원님`

  // 🖼️ 프로필 이미지
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

  // 프로필 데이터가 있는지 확인 (height와 weight가 있는지)
  const hasProfile = profile?.height && profile?.weight

  return (
    <DashboardClient 
      userId={user.id} 
      userName={realName} 
      profile={profile}
    >
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
            {realName}님
          </p>
          <p className="text-sm text-white/50 mb-1">
            {displayName}
          </p>
          <p className="text-white/70 mb-6">
            닥터 도슨 대시보드에 오신 것을 환영합니다.
          </p>

          {/* 건강 분석 리포트 (프로필이 있을 때만 표시) */}
          {hasProfile && profile && (
            <HealthSummary profile={profile} userName={realName} />
          )}

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

          {/* 프로필 수정 버튼 (이미 프로필이 있는 경우) */}
          {hasProfile && (
            <Link 
              href="/profile"
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors mb-3"
            >
              <Settings className="w-5 h-5" />
              건강 프로필 수정
            </Link>
          )}

          {/* 로그아웃 섹션 (클라이언트 컴포넌트) */}
          <LogoutSection />
        </div>
      </div>
    </DashboardClient>
  )
}
