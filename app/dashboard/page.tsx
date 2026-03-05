import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  User, 
  MessageSquare, 
  Activity, 
  ArrowUpRight,
  Settings,
  Calendar
} from 'lucide-react'
import { getAgeFromBirthDate } from '@/utils/health'
import LogoutSection from '../components/LogoutSection'
import DashboardClient from '../components/DashboardClient'
import HealthRadarChart from '../components/HealthRadarChart'
import HealthLogButtons from '../components/HealthLogButtons'
import CycleCareCard from '../components/CycleCareCard'
import HealthReport from '../components/HealthReport'
import DashboardGroupSection from '../components/DashboardGroupSection'
import OtterCard from '../components/OtterCard'
import DashboardShell from '../components/DashboardShell'
import DashboardGreeting from '../components/DashboardGreeting'

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
  let color = 'text-green-500'
  
  if (bmi < 18.5) { category = '저체중'; color = 'text-blue-500' }
  else if (bmi < 23) { category = '정상'; color = 'text-green-500' }
  else if (bmi < 25) { category = '과체중'; color = 'text-yellow-500' }
  else if (bmi < 30) { category = '비만 1단계'; color = 'text-orange-500' }
  else { category = '비만 2단계'; color = 'text-red-500' }
  
  return { value: bmiRounded, category, color }
}

// 🎯 건강 점수 계산 (5대 지표 평균) — age는 birth_date에서 계산된 만 나이
function calculateHealthScore(profile: {
  birth_date?: string | null
  age?: number | null
  height: number | null
  weight: number | null
  conditions?: string | null
  chronic_diseases?: string | null
  bmi?: number | null
}): number {
  let totalScore = 100 // 기본 점수 100점에서 감점 방식
  let deductionCount = 0
  
  // BMI 점수 감점 (최대 -30점)
  let bmiValue = profile.bmi
  if (!bmiValue && profile.height && profile.weight) {
    bmiValue = profile.weight / Math.pow(profile.height / 100, 2)
  }
  
  if (bmiValue) {
    if (bmiValue >= 25 && bmiValue < 30) {
      totalScore -= 15 // 과체중
      deductionCount++
    } else if (bmiValue >= 30) {
      totalScore -= 25 // 비만
      deductionCount++
    } else if (bmiValue < 18.5) {
      totalScore -= 10 // 저체중
      deductionCount++
    }
  }
  
  // 기저질환 감점 (최대 -40점)
  const diseases = profile.chronic_diseases || profile.conditions
  if (diseases) {
    const diseaseList = diseases.split(',').map(d => d.trim().toLowerCase())
    
    // 고혈압 감점
    if (diseaseList.some(d => d.includes('고혈압') || d.includes('혈압') || d.includes('hypertension'))) {
      totalScore -= 20
      deductionCount++
    }
    
    // 당뇨 감점
    if (diseaseList.some(d => d.includes('당뇨') || d.includes('diabetes'))) {
      totalScore -= 20
      deductionCount++
    }
    
    // 기타 질환 (질환당 -10점)
    const otherDiseases = diseaseList.filter(d => 
      !d.includes('고혈압') && !d.includes('혈압') && !d.includes('hypertension') &&
      !d.includes('당뇨') && !d.includes('diabetes')
    )
    totalScore -= Math.min(otherDiseases.length * 10, 20) // 최대 -20점
    if (otherDiseases.length > 0) deductionCount++
  }
  
  const age = profile.age ?? (profile.birth_date ? getAgeFromBirthDate(profile.birth_date) : null)
  if (age !== null) {
    if (age >= 70) {
      totalScore -= 20
      deductionCount++
    } else if (age >= 60) {
      totalScore -= 15
      deductionCount++
    } else if (age >= 50) {
      totalScore -= 10
      deductionCount++
    } else if (age >= 40) {
      totalScore -= 5
      deductionCount++
    }
  }
  
  // 최소 점수 0점 보장
  return Math.max(0, Math.round(totalScore))
}

// 🏥 고혈압 여부 확인
function hasHypertension(conditions: string | null, chronic_diseases?: string | null): boolean {
  const diseases = chronic_diseases || conditions
  if (!diseases) return false
  return diseases.toLowerCase().includes('고혈압') || 
         diseases.toLowerCase().includes('혈압') ||
         diseases.toLowerCase().includes('hypertension')
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
    .select('nickname, birth_date, gender, height, weight, conditions, medications, chronic_diseases, bmi')
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

  // 👤 이름 추출 — profiles.nickname 우선, 없으면 이메일 앞부분 폴백
  const profileNickname = (profile as { nickname?: string | null } | null)?.nickname ?? null
  const emailPrefix = email?.split('@')[0] || '사용자'
  const realName = profileNickname?.trim() || emailPrefix

  // 🏥 차트 번호 생성 (6자리)
  const chartNumber = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()

  // 🖼️ 프로필 이미지
  const rawAvatarUrl = 
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    null
  
  const avatarUrl = toSecureUrl(rawAvatarUrl)

  const currentAge = profile?.birth_date ? getAgeFromBirthDate(profile.birth_date) : null
  const hasProfile = profile?.height && profile?.weight
  const bmi = profile ? calculateBMI(profile.height, profile.weight) : null
  const healthScore = profile ? calculateHealthScore({ ...profile, age: currentAge }) : 0
  const hypertension = hasHypertension(profile?.conditions, profile?.chronic_diseases)

  // 시간대별 인사말
  const hour = new Date().getHours()
  let greeting = '안녕하세요'
  if (hour >= 5 && hour < 12) greeting = '좋은 아침이에요'
  else if (hour >= 12 && hour < 18) greeting = '좋은 오후예요'
  else greeting = '좋은 저녁이에요'

  // 점수에 따른 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    if (score >= 40) return 'text-orange-500'
    return 'text-red-500'
  }

  return (
    <DashboardClient 
      userId={user.id} 
      userName={realName} 
      profile={profile}
    >
      <DashboardShell userId={user.id}>
      <div className="min-h-screen bg-white text-gray-800 p-3 md:p-5 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-6xl mx-auto space-y-4">
          
          {/* 🎯 VIP 인사말 헤더 — Realtime 닉네임 동기화 */}
          <DashboardGreeting
            userId={user.id}
            initialNickname={profileNickname}
            emailPrefix={emailPrefix}
            chartNumber={chartNumber}
            greeting={greeting}
          />

          {/* 📊 4개의 데이터 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* 카드 1: 기본 신체 지표 */}
            <Link 
              href="/profile"
              className="group bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-[#2DD4BF] transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#2DD4BF]/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#2DD4BF]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-bold text-gray-900">기본 신체 지표</h3>
                    <p className="text-xs md:text-sm text-gray-500">Basic Metrics</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              
              {hasProfile && profile ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">나이</span>
                    <span className="font-bold text-gray-900">{currentAge != null ? `${currentAge}세` : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">키</span>
                    <span className="font-bold text-gray-900">{profile.height || '-'}cm</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">몸무게</span>
                    <span className="font-bold text-gray-900">{profile.weight || '-'}kg</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-gray-600 text-sm font-medium">BMI</span>
                    <div className="text-right">
                      <span className={`font-bold text-lg md:text-xl ${bmi?.color || 'text-gray-900'}`}>
                        {bmi?.value || '-'}
                      </span>
                      <span className={`ml-2 text-sm md:text-base font-medium ${bmi?.color || 'text-gray-600'}`}>
                        ({bmi?.category || '-'})
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm">프로필을 등록해주세요</p>
                  <p className="text-[#2DD4BF] text-xs mt-1 font-medium">클릭하여 설정 →</p>
                </div>
              )}
            </Link>

            {/* 카드 2: AI 건강 리포트 */}
            <HealthReport profile={profile} userId={user.id} />

            {/* 카드 3: AI 분석 요약 */}
            <Link 
              href="/chat"
              className="group bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-[#2DD4BF] transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#2DD4BF]/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-[#2DD4BF]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-bold text-gray-900">AI 분석 요약</h3>
                    <p className="text-xs md:text-sm text-gray-500">Last Consultation</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <span>💡 최근 상담 키워드</span>
                </div>
                
                {hasProfile ? (
                  <div className="flex flex-wrap gap-1.5">
                    {bmi && bmi.value >= 25 && (
                      <span className="px-2.5 py-1 bg-orange-50 text-orange-600 text-xs rounded-full">
                        #체중관리
                      </span>
                    )}
                    {profile?.conditions?.includes('고혈압') && (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-xs rounded-full">
                        #혈압관리
                      </span>
                    )}
                    {profile?.conditions?.includes('당뇨') && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-xs rounded-full">
                        #혈당관리
                      </span>
                    )}
                    {currentAge != null && currentAge >= 50 && (
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-xs rounded-full">
                        #중장년건강
                      </span>
                    )}
                    <span className="px-2.5 py-1 bg-[#2DD4BF]/10 text-[#2DD4BF] text-xs rounded-full font-medium">
                      #맞춤상담
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">프로필 등록 후 맞춤 분석 가능</p>
                )}
                
                <div className="pt-2 mt-1 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">AI 상담 시작하기</span>
                    <span className="text-[#2DD4BF] text-sm font-medium group-hover:underline">
                      채팅방 →
                    </span>
                  </div>
                </div>
              </div>
            </Link>

            {/* 카드 4: 종합 건강 점수 */}
            <div className="group bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-[#2DD4BF] transition-all duration-300">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#2DD4BF]/10 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-[#2DD4BF]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-bold text-gray-900">종합 건강 점수</h3>
                    <p className="text-xs md:text-sm text-gray-500">Health Score</p>
                  </div>
                </div>
                <div className={`text-2xl md:text-3xl font-bold flex-shrink-0 ${getScoreColor(healthScore)}`}>
                  {hasProfile ? healthScore : '-'}
                  <span className="text-base md:text-lg font-normal text-gray-600">/100</span>
                </div>
              </div>
              
              {hasProfile ? (
                <div className="space-y-2">
                  {/* 점수 프로그레스 바 */}
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        healthScore >= 80 ? 'bg-green-500' :
                        healthScore >= 60 ? 'bg-yellow-500' :
                        healthScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                  
                  {/* 5대 지표 미니 요약 */}
                  <div className="grid grid-cols-5 gap-0.5 text-center text-[11px]">
                    <div className="p-1">
                      <div className="text-[#2DD4BF]">💪</div>
                      <div className="text-gray-400">체력</div>
                    </div>
                    <div className="p-1">
                      <div className="text-[#2DD4BF]">❤️</div>
                      <div className="text-gray-400">심장</div>
                    </div>
                    <div className="p-1">
                      <div className="text-[#2DD4BF]">🦴</div>
                      <div className="text-gray-400">근골격</div>
                    </div>
                    <div className="p-1">
                      <div className="text-[#2DD4BF]">🥗</div>
                      <div className="text-gray-400">영양</div>
                    </div>
                    <div className="p-1">
                      <div className="text-[#2DD4BF]">🧘</div>
                      <div className="text-gray-400">대사</div>
                    </div>
                  </div>
                  
                  <p className="text-center text-xs text-gray-400">
                    글로벌 의료 가이드라인 기준
                  </p>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-gray-400 text-sm">프로필을 등록하면</p>
                  <p className="text-gray-400 text-sm">건강 점수를 확인할 수 있어요</p>
                </div>
              )}
            </div>
          </div>

          {/* 🦦 수달 상태 카드 */}
          <OtterCard />

          {/* 📝 오늘의 건강 기록 버튼 */}
          <HealthLogButtons />

          {/* 👥 그룹 캘린더 */}
          <DashboardGroupSection />

          {/* 🌸 그날 케어 (여성 사용자 또는 미설정 시에만 표시) */}
          {(!profile?.gender || profile?.gender === 'female') && (
            <CycleCareCard />
          )}

          {/* 🕸️ 건강 레이더 차트 (확장 섹션) */}
          {hasProfile && profile && (
            <div className="bg-white rounded-xl md:rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2 text-gray-900">
                  <Activity className="w-4 h-4 text-[#2DD4BF]" />
                  5대 건강 지표 레이더 차트
                </h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  실시간 분석
                </span>
              </div>
              <HealthRadarChart profile={profile} />
              <p className="text-xs text-gray-400 text-center mt-3">
                * 본 분석은 입력된 정보 기반의 참고용 지표이며, 정확한 진단은 전문의와 상담하세요.
              </p>
            </div>
          )}

          {/* 🎮 주요 액션 버튼 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
            {/* AI 상담 버튼 (메인) */}
            <Link 
              href="/chat"
              className="bg-[#2DD4BF] hover:bg-[#26b8a5] text-white py-3 md:py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01] shadow-md"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-base">AI 상담</span>
            </Link>

            {/* 캘린더 버튼 */}
            <Link 
              href="/calendar"
              className="bg-white hover:bg-gray-50 text-[#2DD4BF] py-3 md:py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 border-[#2DD4BF] hover:scale-[1.01]"
            >
              <Calendar className="w-5 h-5" />
              <span className="text-base">캘린더</span>
            </Link>

            {/* 프로필 설정 버튼 */}
            <Link 
              href="/profile"
              className="bg-white hover:bg-gray-50 text-gray-600 py-3 md:py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-gray-200 hover:scale-[1.01]"
            >
              <Settings className="w-5 h-5 text-[#2DD4BF]" />
              <span className="text-base">{hasProfile ? '프로필' : '설정'}</span>
            </Link>
          </div>

          {/* 📋 계정 정보 (접이식) */}
          <details className="bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm">
            <summary className="p-3 md:p-4 cursor-pointer text-gray-500 text-sm hover:text-gray-700 transition-colors">
              계정 정보 보기
            </summary>
            <div className="px-4 pb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">이메일</span>
                <span className="text-gray-700">{email || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">가입일</span>
                <span className="text-gray-700">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">차트 번호</span>
                <span className="text-[#2DD4BF] font-semibold">#{chartNumber}</span>
              </div>
            </div>
          </details>

          {/* 로그아웃 */}
          <LogoutSection />
        </div>
      </div>
      </DashboardShell>
    </DashboardClient>
  )
}
