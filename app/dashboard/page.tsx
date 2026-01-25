import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Settings, Activity, Heart, Scale, Pill } from 'lucide-react'
import LogoutSection from '../components/LogoutSection'
import DashboardClient from '../components/DashboardClient'
import HealthRadarChart from '../components/HealthRadarChart'

// 🔒 HTTP → HTTPS 변환 함수
function toSecureUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:\/\//i, 'https://')
}

// 🧮 BMI 계산
function calculateBMI(height: number | null, weight: number | null): { value: number; category: string; color: string } | null {
  if (!height || !weight || height <= 0) return null
  const heightM = height / 100
  const bmi = weight / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  
  let category = '정상'
  let color = 'text-green-400'
  
  if (bmi < 18.5) { category = '저체중'; color = 'text-blue-400' }
  else if (bmi < 23) { category = '정상'; color = 'text-green-400' }
  else if (bmi < 25) { category = '과체중'; color = 'text-yellow-400' }
  else if (bmi < 30) { category = '비만 1단계'; color = 'text-orange-400' }
  else { category = '비만 2단계'; color = 'text-red-400' }
  
  return { value: bmiRounded, category, color }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  // 👤 이름 추출
  const realName = 
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.preferred_username ||
    user.identities?.[0]?.identity_data?.nickname ||
    email?.split('@')[0] ||
    '사용자'

  // 🏥 차트 번호 생성 (6자리)
  const chartNumber = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()

  // 🖼️ 프로필 이미지
  const rawAvatarUrl = 
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    null
  
  const avatarUrl = toSecureUrl(rawAvatarUrl)

  // 프로필 데이터 확인
  const hasProfile = profile?.height && profile?.weight
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null

  // 시간대별 인사말
  const hour = new Date().getHours()
  let greeting = '안녕하세요'
  if (hour >= 5 && hour < 12) greeting = '좋은 아침이에요'
  else if (hour >= 12 && hour < 18) greeting = '좋은 오후예요'
  else greeting = '좋은 저녁이에요'

  return (
    <DashboardClient 
      userId={user.id} 
      userName={realName} 
      profile={profile}
    >
      <div className="min-h-screen bg-gradient-to-br from-[#006666] via-[#008080] to-[#007070] text-white p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* 🎯 VIP 인사말 카드 */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="프로필" 
                  className="w-16 h-16 rounded-full border-2 border-[#40E0D0] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#40E0D0]/20 flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-[#40E0D0] text-sm font-medium">차트 #{chartNumber} 선생님</p>
                <h1 className="text-xl md:text-2xl font-bold">
                  {realName}님, {greeting}! 👋
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  오늘 컨디션은 어떠세요?
                </p>
              </div>
            </div>
          </div>

          {/* 📊 건강 데이터 카드 (프로필이 있을 때만) */}
          {hasProfile && profile && bmi && (
            <div className="grid grid-cols-2 gap-4">
              {/* BMI 카드 */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-[#40E0D0]" />
                  <span className="text-white/60 text-xs">BMI 지수</span>
                </div>
                <p className={`text-3xl font-bold ${bmi.color}`}>{bmi.value}</p>
                <p className="text-white/70 text-sm">{bmi.category}</p>
              </div>
              
              {/* 신체 정보 카드 */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-[#40E0D0]" />
                  <span className="text-white/60 text-xs">신체 정보</span>
                </div>
                <p className="text-xl font-bold">{profile.height}cm</p>
                <p className="text-white/70 text-sm">{profile.weight}kg</p>
              </div>
              
              {/* 기저 질환 카드 */}
              {profile.conditions && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-rose-400" />
                    <span className="text-white/60 text-xs">기저 질환</span>
                  </div>
                  <p className="text-sm font-medium text-white/90">{profile.conditions}</p>
                </div>
              )}
              
              {/* 복용 약물 카드 */}
              {profile.medications && (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Pill className="w-4 h-4 text-purple-400" />
                    <span className="text-white/60 text-xs">복용 약물</span>
                  </div>
                  <p className="text-sm font-medium text-white/90">{profile.medications}</p>
                </div>
              )}
            </div>
          )}

          {/* 🕸️ 건강 레이더 차트 */}
          {hasProfile && profile && (
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#40E0D0]" />
                5대 건강 지표
              </h2>
              <HealthRadarChart profile={profile} />
              <p className="text-xs text-white/40 text-center mt-4">
                글로벌 의료 가이드라인 기반 분석
              </p>
            </div>
          )}

          {/* 🎮 액션 버튼들 */}
          <div className="space-y-3">
            {/* AI 상담 버튼 */}
            <Link 
              href="/chat"
              className="w-full bg-[#40E0D0] hover:bg-[#3BC9BB] text-[#006666] py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg"
            >
              <MessageSquare className="w-6 h-6" />
              <span className="text-lg">AI 건강 상담 시작하기</span>
            </Link>

            {/* 프로필 설정 버튼 */}
            <Link 
              href="/profile"
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all border border-white/20"
            >
              <Settings className="w-5 h-5" />
              {hasProfile ? '건강 프로필 수정' : '건강 프로필 설정'}
            </Link>
          </div>

          {/* 📋 계정 정보 (접이식) */}
          <details className="bg-white/5 rounded-2xl border border-white/10">
            <summary className="p-4 cursor-pointer text-white/60 text-sm hover:text-white/80 transition-colors">
              계정 정보 보기
            </summary>
            <div className="px-4 pb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">이메일</span>
                <span className="text-white/80">{email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">가입일</span>
                <span className="text-white/80">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">차트 번호</span>
                <span className="text-[#40E0D0]">#{chartNumber}</span>
              </div>
            </div>
          </details>

          {/* 로그아웃 */}
          <LogoutSection />
        </div>
      </div>
    </DashboardClient>
  )
}
