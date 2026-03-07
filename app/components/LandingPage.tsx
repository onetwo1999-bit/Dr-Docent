'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  MessageSquare, Mail, Eye, EyeOff,
  ChevronDown, Clock, PenLine, FileText,
  BarChart2, ClipboardList, Languages, TrendingUp,
} from 'lucide-react'
import { getAppUrl } from '@/app/lib/env-check'

/* ════════════════════════════════════════════
   훅: 스크롤 페이드인 (translateY 20px → 0)
════════════════════════════════════════════ */
function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function FadeSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className}`}
    >
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════
   Canvas: 점·선 애니메이션 (히어로 배경)
════════════════════════════════════════════ */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const PARTICLE_COUNT = 55
    const CONNECT_DIST = 140
    const COLOR = 'rgba(249, 115, 22,' // orange-500

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    type Particle = { x: number; y: number; vx: number; vy: number; r: number }
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 1.5,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 선
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.22
            ctx.beginPath()
            ctx.strokeStyle = `${COLOR}${alpha})`
            ctx.lineWidth = 1
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // 점
      particles.forEach(p => {
        ctx.beginPath()
        ctx.fillStyle = `${COLOR}0.28)`
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  )
}

/* ════════════════════════════════════════════
   숫자 카운팅 애니메이션 컴포넌트
════════════════════════════════════════════ */
function CountUp({ target, suffix = '', duration = 1500 }: {
  target: number
  suffix?: string
  duration?: number
}) {
  const [count, setCount] = useState(0)
  const { ref, visible } = useFadeIn(0.3)
  const started = useRef(false)

  useEffect(() => {
    if (!visible || started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // easeOut cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, target, duration])

  return (
    <div ref={ref} className="text-4xl font-bold text-orange-500">
      {count}{suffix}
    </div>
  )
}

/* ════════════════════════════════════════════
   타이핑 효과 컴포넌트
════════════════════════════════════════════ */
const TYPING_LINES = [
  'Chief Complaint: 내과 외래 방문',
  'Medical History: 고혈압 진단력, 통풍 병력',
  'Current Medications: 콜킨정, 페북트정',
  'Recent Activity: 주 3회 유산소, 평균 수면 6.8h',
  'Review of Systems: 최근 2주 두통 빈도 증가',
]

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

function TypingEffect() {
  const { ref, visible } = useFadeIn(0.2)
  const [displayLines, setDisplayLines] = useState<string[]>([])
  const [currentText, setCurrentText] = useState('')
  const [cursorOn, setCursorOn] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setCursorOn(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    ;(async () => {
      while (!cancelled) {
        setDisplayLines([])
        setCurrentText('')

        for (let li = 0; li < TYPING_LINES.length && !cancelled; li++) {
          const line = TYPING_LINES[li]
          for (let c = 0; c <= line.length && !cancelled; c++) {
            setCurrentText(line.slice(0, c))
            await sleep(45)
          }
          if (!cancelled) {
            await sleep(500)
            setDisplayLines(prev => [...prev, line])
            setCurrentText('')
          }
        }

        if (!cancelled) await sleep(1200)
      }
    })()

    return () => { cancelled = true }
  }, [visible])

  return (
    <div
      ref={ref}
      className="bg-black/30 border border-white/10 rounded-2xl p-5 w-full max-w-sm text-left font-mono"
    >
      <div className="text-[10px] text-gray-500 mb-3 uppercase tracking-widest">의료진용 · Medical Report</div>
      <div className="space-y-1.5">
        {displayLines.map((line, i) => (
          <p key={i} className="text-sm text-green-300/90">{line}</p>
        ))}
        <p className="text-sm text-green-300/90 min-h-[1.25rem]">
          {currentText}
          <span className={cursorOn ? 'opacity-100' : 'opacity-0'}>▋</span>
        </p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   문진표 목업 카드
════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════════ */
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
  const scrollToCTA = useCallback(() => ctaRef.current?.scrollIntoView({ behavior: 'smooth' }), [])

  return (
    <div className="bg-white text-gray-900 overflow-x-hidden">

      {/* ══════════════════════════════════════════
          섹션 1 — 히어로 (Canvas 배경)
      ══════════════════════════════════════════ */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
        <ParticleCanvas />
        <div className="relative z-10 max-w-2xl mx-auto">
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
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce z-10">
          <ChevronDown className="w-6 h-6 text-gray-300" />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          섹션 2 — 문제 정의
      ══════════════════════════════════════════ */}
      <section className="bg-[#FFF8F0] py-24 px-6">
        <FadeSection className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-12">이런 경험 있으신가요?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: <Clock className="w-7 h-7 text-orange-500" />, text: '3분 진료 시간, 할 말을 다 못했습니다' },
              { icon: <PenLine className="w-7 h-7 text-orange-500" />, text: '기록은 하고 싶은데, 매일 귀찮았습니다' },
              { icon: <FileText className="w-7 h-7 text-orange-500" />, text: '내 몸 상태를 글로 정리한 적이 없습니다' },
            ].map(({ icon, text }, i) => (
              <FadeSection key={i} delay={i * 120}>
                <div className="bg-white rounded-2xl p-7 shadow-sm border border-orange-100 flex flex-col items-center gap-4 text-center h-full">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">{icon}</div>
                  <p className="text-gray-700 font-medium leading-relaxed">{text}</p>
                </div>
              </FadeSection>
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
          섹션 3.5 — AI 번역 섹션 (신규)
      ══════════════════════════════════════════ */}
      <section className="bg-[#F8F8F8] py-24 px-6">
        <div className="max-w-5xl mx-auto">

          {/* 타이틀 */}
          <FadeSection className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              AI가 기록을 의사의 언어로 번역합니다
            </h2>
          </FadeSection>

          {/* 3카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-16">
            {[
              {
                icon: <FileText className="w-6 h-6 text-orange-500" />,
                title: '흩어진 기록을 하나로',
                desc: '매일의 식사, 운동, 수면, 복약 기록을\nAI가 맥락 있는 문서로 정리합니다',
              },
              {
                icon: <Languages className="w-6 h-6 text-orange-500" />,
                title: '정밀한 진단을 위한 언어로',
                desc: '일상의 언어로 작성된 기록을\n의학적 용어와 SOAP 형식으로 변환합니다',
              },
              {
                icon: <TrendingUp className="w-6 h-6 text-orange-500" />,
                title: '누적될수록 정밀해집니다',
                desc: '7일, 30일, 66일\n기록이 쌓일수록 AI 분석이 정교해집니다',
              },
            ].map(({ icon, title, desc }, i) => (
              <FadeSection key={i} delay={i * 120}>
                <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex flex-col gap-4 h-full">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">{icon}</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{desc}</p>
                  </div>
                </div>
              </FadeSection>
            ))}
          </div>

          {/* 숫자 카운팅 */}
          <FadeSection>
            <div className="grid grid-cols-3 gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8 max-w-xl mx-auto text-center mb-12">
              {[
                { target: 7, suffix: '일', label: '첫 패턴 형성' },
                { target: 30, suffix: '일', label: '건강 추세 분석' },
                { target: 66, suffix: '일', label: 'AI 정밀 리포트' },
              ].map(({ target, suffix, label }) => (
                <div key={target}>
                  <CountUp target={target} suffix={suffix} duration={1500} />
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </FadeSection>

          {/* 강조 문구 */}
          <FadeSection className="text-center">
            <p className="text-base text-gray-500 leading-relaxed">
              단순한 기록 앱이 아닙니다.<br />
              <span className="text-orange-500 font-semibold">당신의 건강 언어를 번역하는 AI입니다</span>
            </p>
          </FadeSection>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          섹션 4 — 핵심 기능 3가지
      ══════════════════════════════════════════ */}
      <section className="py-20 px-6 bg-white">
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
              <div className={`grid grid-cols-1 sm:grid-cols-2 items-center gap-16 ${reverse ? 'sm:[&>*:first-child]:order-2 sm:[&>*:last-child]:order-1' : ''}`}>
                {/* 이미지 카드 */}
                <div className="flex items-center justify-center">
                  <div className="w-56 h-56 rounded-3xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                    {icon}
                  </div>
                </div>

                {/* 텍스트 블록 */}
                <div className="flex flex-col justify-center text-center sm:text-left">
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
          섹션 5 — 문진표 미리보기 (타이핑 효과)
      ══════════════════════════════════════════ */}
      <section className="bg-[#1a1a1a] py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeSection className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              3분의 진료를 위한<br />당신의 24시간
            </h2>
            <p className="text-gray-400 text-base">
              일반인용 · 의료진용 두 가지 문진표를 즉시 발급합니다
            </p>
          </FadeSection>

          <div className="flex flex-col sm:flex-row justify-center gap-5">
            {/* 일반인용 정적 카드 */}
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
            {/* 의료진용 타이핑 카드 */}
            <TypingEffect />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          섹션 6 — CTA + 로그인
      ══════════════════════════════════════════ */}
      <section ref={ctaRef} className="py-28 px-6 bg-white">
        <FadeSection className="max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">지금 시작하기</h2>
          <p className="text-gray-400 mb-10">무료로 기록을 시작하세요</p>

          <div className="space-y-4">
            <button
              onClick={handleKakaoLogin}
              disabled={isLoading}
              className="w-full bg-[#FEE500] hover:bg-[#FADA00] text-[#191919] py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <MessageSquare className="w-5 h-5 fill-current" />
              카카오로 1초 만에 시작하기
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">또는</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

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
