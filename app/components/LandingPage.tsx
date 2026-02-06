'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { HeartPulse, ShieldCheck, Database, MessageSquare, Mail, Eye, EyeOff } from 'lucide-react'
import { getAppUrl } from '@/app/lib/env-check'
import MedicalDisclaimer from './MedicalDisclaimer'

export default function LandingPage() {
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase 클라이언트 생성
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 카카오 로그인 핸들러 (개인 개발자 버전)
  const handleKakaoLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // 환경 변수 기반 앱 URL 사용
      const appUrl = getAppUrl()
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          // 개인 개발자 버전: 기본 스코프만 사용
          scopes: 'profile_nickname profile_image',
          redirectTo: `${appUrl}/auth/callback`,
          queryParams: {
            prompt: 'login consent',
          },
        },
      })

      if (error) throw error
    } catch (error: unknown) {
      console.error('로그인 에러 발생:', error)
      const msg = error instanceof Error ? error.message : String(error)
      const isNetwork =
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('Failed to fetch') ||
        msg.includes('Load failed') ||
        /DNS|ENOTFOUND|getaddrinfo/i.test(msg)
      if (isNetwork) {
        setError('Supabase 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.')
      } else {
        setError('로그인 연결 중 문제가 발생했습니다. 관리자에게 문의해주세요.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 이메일 로그인/회원가입 핸들러
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const appUrl = getAppUrl()

      if (isSignUp) {
        // 회원가입
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${appUrl}/auth/callback`,
          },
        })

        if (error) throw error
        alert('회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.')
      } else {
        // 로그인
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        
        // 로그인 성공 시 대시보드로 리다이렉트
        window.location.href = '/dashboard'
      }
    } catch (error: unknown) {
      console.error('이메일 인증 에러:', error)
      const msg = error instanceof Error ? error.message : String(error)
      setError(msg.includes('Invalid login') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col items-center justify-center p-6">
      {/* 헤더 섹션 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 leading-tight text-gray-900">
          데이터로 완성하는<br />나만의 건강 차트,<br /><span className="text-[#2DD4BF]">닥터 도슨</span>
        </h1>
        <p className="text-gray-500 text-lg">
          글로벌 의학적 기준에 맞춘<br/>프리미엄 건강 관리 솔루션
        </p>
      </div>

      {/* 서비스 특장점 카드 */}
      <div className="bg-white rounded-2xl p-8 w-full max-w-md space-y-8 mb-12 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-4">
          <HeartPulse className="w-8 h-8 text-[#2DD4BF]" />
          <div>
            <h3 className="font-bold text-lg text-gray-900">정교한 AI 분석</h3>
            <p className="text-gray-500 text-sm">수만 건의 의료 데이터를 학습한 AI가 당신의 기록을 정밀 분석합니다.</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Database className="w-8 h-8 text-[#2DD4BF]" />
          <div>
            <h3 className="font-bold text-lg text-gray-900">빅데이터 기반 솔루션</h3>
            <p className="text-gray-500 text-sm">감이 아닌 데이터로, 최적의 건강 관리 가이드를 제안합니다.</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <ShieldCheck className="w-8 h-8 text-[#2DD4BF]" />
          <div>
            <h3 className="font-bold text-lg text-gray-900">프라이빗 헬스케어</h3>
            <p className="text-gray-500 text-sm">철저한 보안 시스템으로 관리되는 나만의 건강 비서.</p>
          </div>
        </div>
      </div>

      {/* 로그인 옵션 */}
      <div className="w-full max-w-md space-y-4">
        {/* 카카오 로그인 버튼 */}
        <button
          onClick={handleKakaoLogin}
          disabled={isLoading}
          className="w-full bg-[#FEE500] text-[#191919] py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#FADA00] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MessageSquare className="w-6 h-6 fill-current" />
          카카오로 1초 만에 시작하기
        </button>

        {/* 구분선 */}
        <div className="relative flex items-center my-6">
          <div className="flex-1 border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500 bg-white">또는</span>
          <div className="flex-1 border-t border-gray-300"></div>
        </div>

        {/* 이메일 로그인 토글 버튼 */}
        {!showEmailLogin ? (
          <button
            onClick={() => setShowEmailLogin(true)}
            className="w-full bg-white border-2 border-[#2DD4BF] text-[#2DD4BF] py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#2DD4BF]/5 transition-colors"
          >
            <Mail className="w-5 h-5" />
            이메일로 로그인
          </button>
        ) : (
          <form onSubmit={handleEmailAuth} className="w-full bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent pr-12"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSignUp ? '회원가입' : '로그인'}
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold transition-colors"
              >
                {isSignUp ? '로그인' : '회원가입'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowEmailLogin(false)
                setError(null)
                setEmail('')
                setPassword('')
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              다른 로그인 방법 사용
            </button>
          </form>
        )}
      </div>

      {/* 푸터 면책조항 */}
      <div className="mt-8 w-full max-w-md">
        <MedicalDisclaimer variant="compact" />
      </div>
    </div>
  )
}
