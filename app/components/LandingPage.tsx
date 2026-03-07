'use client'

import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  MessageSquare, Mail, Eye, EyeOff,
  ChevronDown, Clock, PenLine, FileText,
  BarChart2, ClipboardList,
} from 'lucide-react'
import { getAppUrl } from '@/app/lib/env-check'

/* ─── 스크롤 애니메이션 훅 ─── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

/* ─── 섹션 래퍼 ─── */
function FadeSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  )
}

/* ─── 문진표 목업 카드 ─── */
function QuestionnaireMockup({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-5 w-full max-w-xs">
      <div className="text-xs font-semibold text-orange-300 mb-3 uppercase tracking-wide">{label}</div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
            <p className="text-sm text-white/80 leading-snug">{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleKakaoLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const appUrl = getAppUrl()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          scopes: 'profile_nickname profile_image',
          redirectTo: `${appUrl}/auth/callback`,
          queryParams: { prompt: 'login consent' },
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNetwork = /fetch|network|Failed to fetch|Load failed|DNS|ENOTFOUND|getaddrinfo/i.test(msg)
      setError(isNetwork
        ? 'Supabase 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.'
        : '로그인 연결 중 문제가 발생했습니다. 관리자에게 문의해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('이메일과 비밀번호를 입력해주세요.'); return }
    setIsLoading(true)
    setError(null)
    try {
      const appUrl = getAppUrl()
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${appUrl}/auth/callback` },
        })
        if (error) throw error
        alert('회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = '/dashboard'
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('Invalid login') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : msg)
    } finally {
      setIsLoading(false)
    }
  }

  const ctaRef = useRef<HTMLElement>(null)
  const scrollToCTA = () => ctaRef.current?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="bg-white text-gray-900 overflow-x-hidden">

      {/* ══════════════════════════════════════════
          섹션 1 — 히어로
      ══════════════════════════════════════════ */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-orange-500 tracking-widest uppercase mb-6">닥터 도슨 · Dr. Docent</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-gray-900 mb-6">
            점과 점을<br />선으로 잇습니다
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed mb-10">
            매일의 기록이 진료실에서<br className="sm:hidden" /> 정확한 언어가 됩니다
          </p>
          <button
            onClick={scrollToCTA}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full font-semibold text-base transition-colors shadow-lg shadow-orange-200"
          >
            지금 시작하기
          </button>
        </div>

        {/* 스크롤 화살표 */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-gray-300" />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          섹션 2 — 문제 정의
      ══════════════════════════════════════════ */}
      <section className="bg-[#FFF8F0] py-24 px-6">
        <FadeSection className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-12">
            이런 경험 있으신가요?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: <Clock className="w-7 h-7 text-orange-500" />, text: '3분 진료 시간, 할 말을 다 못했습니다' },
              { icon: <PenLine className="w-7 h-7 text-orange-500" />, text: '기록은 하고 싶은데, 매일 귀찮았습니다' },
              { icon: <FileText className="w-7 h-7 text-orange-500" />, text: '내 몸 상태를 글로 정리한 적이 없습니다' },
            ].map(({ icon, text }, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 shadow-sm border border-orange-100 flex flex-col items-center gap-4 text-center">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                  {icon}
                </div>
                <p className="text-gray-700 font-medium leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </FadeSection>
      </section>

      {/* ══════════════════════════════════════════
          섹션 3 — 서비스 소개
      ══════════════════════════════════════════ */}
      <section className="py-28 px-6">
        <FadeSection className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight">
            기록이 쌓이면,<br />언어가 됩니다
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            흩어진 일상의 데이터를<br />의사가 읽는 언어로 변환합니다
          </p>
          <div className="mt-10 w-16 h-1 bg-orange-400 mx-auto rounded-full" />
        </FadeSection>
      </section>

      {/* ══════════════════════════════════════════
          섹션 4 — 핵심 기능 3가지
      ══════════════════════════════════════════ */}
      <section className="py-10 px-6 bg-white">
        <div className="max-w-4xl mx-auto space-y-20">
          {[
            {
              num: '01',
              title: '기록',
              desc: '매일의 식사, 운동, 수면, 복약을\n부담 없이 남깁니다',
              icon: <PenLine className="w-10 h-10 text-orange-500" />,
              reverse: false,
            },
            {
              num: '02',
              title: '분석',
              desc: '누적된 기록이\n나만의 건강 패턴이 됩니다',
              icon: <BarChart2 className="w-10 h-10 text-orange-500" />,
              reverse: true,
            },
            {
              num: '03',
              title: '변환',
              desc: '병원 방문 전 두 가지 문진표로 정리해드립니다\n나를 위한 버전, 의사를 위한 버전',
              icon: <ClipboardList className="w-10 h-10 text-orange-500" />,
              reverse: false,
            },
          ].map(({ num, title, desc, icon, reverse }) => (
            <FadeSection key={num}>
              <div className={`flex flex-col ${reverse ? 'sm:flex-row-reverse' : 'sm:flex-row'} items-center gap-10`}>
                {/* 비주얼 */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-3xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                    {icon}
                  </div>
                </div>
                {/* 텍스트 */}
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-xs font-bold text-orange-400 tracking-widest uppercase mb-2">{num}</p>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">{title}</h3>
                  <p className="text-gray-500 text-base leading-relaxed whitespace-pre-line">{desc}</p>
                </div>
              </div>
            </FadeSection>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          섹션 5 — 문진표 미리보기
      ══════════════════════════════════════════ */}
      <section className="bg-[#1a1a1a] py-28 px-6">
        <FadeSection className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            3분의 진료를 위한<br />당신의 24시간
          </h2>
          <p className="text-gray-400 text-base mb-14">
            일반인용 · 의료진용 두 가지 문진표를 즉시 발급합니다
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <QuestionnaireMockup
              label="일반인용"
              items={[
                '최근 30일 평균 수면 6.8시간',
                '식사 기록 24건 — 저염 식단 위주',
                '운동 기록 12건 — 주 3회 유산소',
                '복약 기록: 고혈압약 매일 복용',
                '특이사항: 최근 2주 두통 빈도 증가',
              ]}
            />
            <QuestionnaireMockup
              label="의료진용 (Medical)"
              items={[
                'Chief Complaint: 내과 외래',
                'Hx: HTN, 현재 ARB 계열 복용 중',
                'Vitals: BMI 23.4 (정상 범위)',
                'Activity: Aerobic ex. 3×/wk, avg 40min',
                'ROS: Headache frequency ↑ (2wks)',
              ]}
            />
          </div>
        </FadeSection>
      </section>

      {/* ══════════════════════════════════════════
          섹션 6 — CTA + 로그인
      ══════════════════════════════════════════ */}
      <section ref={ctaRef} className="py-28 px-6 bg-white">
        <FadeSection className="max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">지금 시작하기</h2>
          <p className="text-gray-400 mb-10">무료로 기록을 시작하세요</p>

          <div className="space-y-4">
            {/* 카카오 */}
            <button
              onClick={handleKakaoLogin}
              disabled={isLoading}
              className="w-full bg-[#FEE500] hover:bg-[#FADA00] text-[#191919] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <MessageSquare className="w-5 h-5 fill-current" />
              카카오로 1초 만에 시작하기
            </button>

            {/* 구분선 */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 이메일 */}
            {!showEmailLogin ? (
              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full border-2 border-orange-500 text-orange-500 hover:bg-orange-50 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-colors"
              >
                <Mail className="w-5 h-5" />
                이메일로 로그인
              </button>
            ) : (
              <form onSubmit={handleEmailAuth} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    disabled={isLoading}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="비밀번호를 입력하세요"
                      disabled={isLoading}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent pr-12 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                  >
                    {isLoading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm transition-colors"
                  >
                    {isSignUp ? '로그인' : '회원가입'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowEmailLogin(false); setError(null); setEmail(''); setPassword('') }}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 pt-1"
                >
                  다른 로그인 방법 사용
                </button>
              </form>
            )}

            {/* 이메일 로그인 바깥 에러 (kakao 등) */}
            {error && !showEmailLogin && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}
          </div>
        </FadeSection>
      </section>

      {/* ══════════════════════════════════════════
          푸터
      ══════════════════════════════════════════ */}
      <footer className="bg-gray-50 border-t border-gray-100 py-10 px-6 text-center">
        <p className="font-semibold text-gray-700 mb-2">닥터 도슨 (Dr. Docent)</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          본 서비스는 의료 진단 목적이 아니며,<br />
          정확한 진단은 전문의와 상담하세요
        </p>
      </footer>

    </div>
  )
}
