'use client'

import { createBrowserClient } from '@supabase/ssr'
import { HeartPulse, ShieldCheck, Database, MessageSquare } from 'lucide-react'

export default function LandingPage() {
  // Supabase 클라이언트 생성
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 카카오 로그인 핸들러
  const handleKakaoLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          // 심사 없이 허용되는 스코프만 요청
          scopes: 'profile_nickname profile_image',
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'login consent',
          },
        },
      })

      if (error) throw error
    } catch (error) {
      console.error('로그인 에러 발생:', error)
      alert('로그인 연결 중 문제가 발생했습니다. 관리자에게 문의해주세요.')
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

      {/* 카카오 로그인 버튼 */}
      <button
        onClick={handleKakaoLogin}
        className="w-full max-w-md bg-[#FEE500] text-[#191919] py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#FADA00] transition-colors shadow-md"
      >
        <MessageSquare className="w-6 h-6 fill-current" />
        카카오로 1초 만에 시작하기
      </button>

      {/* 푸터 면책조항 */}
      <p className="mt-8 text-xs text-gray-400 text-center max-w-xs leading-relaxed">
        본 서비스는 정보 제공을 목적으로 하며, 의학적 진단이나 치료를 대신할 수 없습니다. 중요한 건강 결정은 반드시 전문가와 상담하세요.
      </p>
    </div>
  )
}
