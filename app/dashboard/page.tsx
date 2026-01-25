import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  User, 
  HeartPulse, 
  MessageSquare, 
  Activity, 
  ArrowUpRight,
  Settings
} from 'lucide-react'
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

// 🎯 건강 점수 계산 (5대 지표 평균)
function calculateHealthScore(profile: {
  age: number | null
  height: number | null
  weight: number | null
  conditions: string | null
}): number {
  let totalScore = 0
  let factors = 0
  
  // BMI 점수 (40점 만점)
  if (profile.height && profile.weight) {
    const bmi = profile.weight / Math.pow(profile.height / 100, 2)
    if (bmi >= 18.5 && bmi < 23) totalScore += 40
    else if (bmi >= 23 && bmi < 25) totalScore += 30
    else if (bmi < 18.5 || (bmi >= 25 && bmi < 30)) totalScore += 20
    else totalScore += 10
    factors++
  }
  
  // 나이 점수 (20점 만점)
  if (profile.age) {
    if (profile.age < 40) totalScore += 20
    else if (profile.age < 50) totalScore += 17
    else if (profile.age < 60) totalScore += 14
    else if (profile.age < 70) totalScore += 11
    else totalScore += 8
    factors++
  }
  
  // 기저질환 점수 (40점 만점)
  if (profile.conditions) {
    const conditionCount = profile.conditions.split(',').length
    if (conditionCount === 0) totalScore += 40
    else if (conditionCount === 1) totalScore += 30
    else if (conditionCount === 2) totalScore += 20
    else totalScore += 10
  } else {
    totalScore += 40
  }
  factors++
  
  return factors > 0 ? Math.round(totalScore / factors * 2.5) : 0
}

// 🏥 고혈압 여부 확인
function hasHypertension(conditions: string | null): boolean {
  if (!conditions) return false
  return conditions.toLowerCase().includes('고혈압') || 
         conditions.toLowerCase().includes('혈압') ||
         conditions.toLowerCase().includes('hypertension')
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
  const healthScore = profile ? calculateHealthScore(profile) : 0
  const hypertension = hasHypertension(profile?.conditions)

  // 시간대별 인사말
  const hour = new Date().getHours()
  let greeting = '안녕하세요'
  if (hour >= 5 && hour < 12) greeting = '좋은 아침이에요'
  else if (hour >= 12 && hour < 18) greeting = '좋은 오후예요'
  else greeting = '좋은 저녁이에요'

  // 점수에 따른 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <DashboardClient 
      userId={user.id} 
      userName={realName} 
      profile={profile}
    >
      <div className="min-h-screen bg-gradient-to-br from-[#006666] via-[#008080] to-[#007070] text-white p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* 🎯 VIP 인사말 헤더 */}
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

          {/* 📊 4개의 데이터 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 카드 1: 기본 신체 지표 */}
            <Link 
              href="/profile"
              className="group bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-md hover:shadow-xl hover:scale-105 hover:bg-white/15 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#40E0D0]/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#40E0D0]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">기본 신체 지표</h3>
                    <p className="text-xs text-white/50">Basic Metrics</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-[#40E0D0] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              
              {hasProfile && profile ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">나이</span>
                    <span className="font-medium">{profile.age || '-'}세</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">키</span>
                    <span className="font-medium">{profile.height || '-'}cm</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">몸무게</span>
                    <span className="font-medium">{profile.weight || '-'}kg</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-white/60 text-sm">BMI</span>
                    <div className="text-right">
                      <span className={`font-bold text-lg ${bmi?.color || 'text-white'}`}>
                        {bmi?.value || '-'}
                      </span>
                      <span className={`ml-2 text-xs ${bmi?.color || 'text-white/50'}`}>
                        ({bmi?.category || '-'})
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-white/50 text-sm">프로필을 등록해주세요</p>
                  <p className="text-[#40E0D0] text-xs mt-1">클릭하여 설정 →</p>
                </div>
              )}
            </Link>

            {/* 카드 2: 건강 주의사항 */}
            <Link 
              href="/profile"
              className="group bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-md hover:shadow-xl hover:scale-105 hover:bg-white/15 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                    <HeartPulse className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">건강 주의사항</h3>
                    <p className="text-xs text-white/50">Health Alerts</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-rose-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">고혈압</span>
                  <span className={`font-medium ${hypertension ? 'text-rose-400' : 'text-green-400'}`}>
                    {hypertension ? '⚠️ 주의' : '✓ 정상'}
                  </span>
                </div>
                
                <div className="pt-2 border-t border-white/10">
                  <span className="text-white/60 text-sm block mb-2">기저질환</span>
                  {profile?.conditions ? (
                    <div className="flex flex-wrap gap-1">
                      {profile.conditions.split(',').slice(0, 3).map((condition: string, idx: number) => (
                        <span 
                          key={idx}
                          className="px-2 py-1 bg-rose-500/20 text-rose-300 text-xs rounded-full"
                        >
                          {condition.trim()}
                        </span>
                      ))}
                      {profile.conditions.split(',').length > 3 && (
                        <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-full">
                          +{profile.conditions.split(',').length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-green-400 text-sm">✓ 등록된 질환 없음</p>
                  )}
                </div>
                
                {profile?.medications && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-white/60 text-sm block mb-1">복용 약물</span>
                    <p className="text-purple-300 text-sm truncate">{profile.medications}</p>
                  </div>
                )}
              </div>
            </Link>

            {/* 카드 3: AI 분석 요약 */}
            <Link 
              href="/chat"
              className="group bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-md hover:shadow-xl hover:scale-105 hover:bg-white/15 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">AI 분석 요약</h3>
                    <p className="text-xs text-white/50">Last Consultation</p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-white/40 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <span>💡 최근 상담 키워드</span>
                </div>
                
                {hasProfile ? (
                  <div className="flex flex-wrap gap-1.5">
                    {bmi && bmi.value >= 25 && (
                      <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">
                        #체중관리
                      </span>
                    )}
                    {profile?.conditions?.includes('고혈압') && (
                      <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 text-xs rounded-full">
                        #혈압관리
                      </span>
                    )}
                    {profile?.conditions?.includes('당뇨') && (
                      <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full">
                        #혈당관리
                      </span>
                    )}
                    {profile?.age && profile.age >= 50 && (
                      <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                        #중장년건강
                      </span>
                    )}
                    <span className="px-2.5 py-1 bg-[#40E0D0]/20 text-[#40E0D0] text-xs rounded-full">
                      #맞춤상담
                    </span>
                  </div>
                ) : (
                  <p className="text-white/50 text-sm">프로필 등록 후 맞춤 분석 가능</p>
                )}
                
                <div className="pt-3 mt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-sm">AI 상담 시작하기</span>
                    <span className="text-[#40E0D0] text-sm font-medium group-hover:underline">
                      채팅방 →
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {/* 카드 4: 종합 건강 점수 */}
            <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-md hover:shadow-xl hover:scale-105 hover:bg-white/15 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">종합 건강 점수</h3>
                    <p className="text-xs text-white/50">Health Score</p>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(healthScore)}`}>
                  {hasProfile ? healthScore : '-'}
                  <span className="text-sm font-normal text-white/50">/100</span>
                </div>
              </div>
              
              {hasProfile ? (
                <div className="space-y-3">
                  {/* 점수 프로그레스 바 */}
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        healthScore >= 80 ? 'bg-green-400' :
                        healthScore >= 60 ? 'bg-yellow-400' :
                        healthScore >= 40 ? 'bg-orange-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                  
                  {/* 5대 지표 미니 요약 */}
                  <div className="grid grid-cols-5 gap-1 text-center text-xs">
                    <div className="p-1">
                      <div className="text-[#40E0D0]">💪</div>
                      <div className="text-white/50">체력</div>
                    </div>
                    <div className="p-1">
                      <div className="text-rose-400">❤️</div>
                      <div className="text-white/50">심장</div>
                    </div>
                    <div className="p-1">
                      <div className="text-amber-400">🦴</div>
                      <div className="text-white/50">근골격</div>
                    </div>
                    <div className="p-1">
                      <div className="text-green-400">🥗</div>
                      <div className="text-white/50">영양</div>
                    </div>
                    <div className="p-1">
                      <div className="text-purple-400">🧘</div>
                      <div className="text-white/50">대사</div>
                    </div>
                  </div>
                  
                  <p className="text-center text-xs text-white/40">
                    글로벌 의료 가이드라인 기준
                  </p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-white/50 text-sm">프로필을 등록하면</p>
                  <p className="text-white/50 text-sm">건강 점수를 확인할 수 있어요</p>
                </div>
              )}
            </div>
          </div>

          {/* 🕸️ 건강 레이더 차트 (확장 섹션) */}
          {hasProfile && profile && (
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#40E0D0]" />
                  5대 건강 지표 레이더 차트
                </h2>
                <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded-full">
                  실시간 분석
                </span>
              </div>
              <HealthRadarChart profile={profile} />
              <p className="text-xs text-white/40 text-center mt-4">
                * 본 분석은 입력된 정보 기반의 참고용 지표이며, 정확한 진단은 전문의와 상담하세요.
              </p>
            </div>
          )}

          {/* 🎮 주요 액션 버튼 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* AI 상담 버튼 */}
            <Link 
              href="/chat"
              className="bg-[#40E0D0] hover:bg-[#3BC9BB] text-[#006666] py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg"
            >
              <MessageSquare className="w-6 h-6" />
              <span className="text-lg">AI 건강 상담 시작</span>
            </Link>

            {/* 프로필 설정 버튼 */}
            <Link 
              href="/profile"
              className="bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all border border-white/20 hover:scale-[1.02]"
            >
              <Settings className="w-6 h-6" />
              <span className="text-lg">{hasProfile ? '프로필 수정' : '프로필 설정'}</span>
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
