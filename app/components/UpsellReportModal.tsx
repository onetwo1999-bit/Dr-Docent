'use client'

import { useState } from 'react'
import { X, Check, Sparkles } from 'lucide-react'

interface UpsellReportModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectBasic?: () => void
  onSelectVIP?: () => void
  onReferralCode?: () => void
}

export default function UpsellReportModal({
  isOpen,
  onClose,
  onSelectBasic,
  onSelectVIP,
  onReferralCode,
}: UpsellReportModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen) return null

  const handleBasicClick = async () => {
    setIsProcessing(true)
    try {
      if (onSelectBasic) {
        await onSelectBasic()
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleVIPClick = async () => {
    setIsProcessing(true)
    try {
      if (onSelectVIP) {
        await onSelectVIP()
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            회원님의 1년 치 건강 데이터를 심층 분석했습니다.
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 md:p-8">
          {/* 가격 비교 카드 (2컬럼) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
            {/* 좌측: Basic (1회성 리포트) */}
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50/50">
              <div className="mb-4">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">1회성 리포트 열람</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-bold text-gray-900">19,900</span>
                  <span className="text-base md:text-lg text-gray-600">원</span>
                </div>
              </div>
              <button
                onClick={handleBasicClick}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold text-base md:text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '처리 중...' : '1회성 리포트 구매'}
              </button>
            </div>

            {/* 우측: VIP Membership */}
            <div className="border-2 border-[#d4af37] rounded-xl p-6 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] relative overflow-hidden">
              {/* 추천 뱃지 */}
              <div className="absolute top-4 right-4 bg-[#d4af37] text-[#1a1a1a] px-3 py-1 rounded-full text-xs md:text-sm font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                추천
              </div>

              <div className="mb-4">
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">VIP 연간 구독</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl md:text-3xl font-bold text-[#d4af37]">월 4,900</span>
                  <span className="text-base md:text-lg text-gray-300">원</span>
                </div>
                {/* 첫 3개월 30% 할인 뱃지 */}
                <div className="inline-flex items-center gap-1 bg-[#d4af37]/20 border border-[#d4af37]/50 rounded-lg px-2 py-1 mb-3">
                  <span className="text-xs md:text-sm font-semibold text-[#d4af37]">
                    첫 3개월 30% 할인
                  </span>
                </div>
              </div>

              {/* VIP 혜택 리스트 */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <span className="text-base md:text-lg text-gray-200">연간 리포트 무료 제공</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <span className="text-base md:text-lg text-gray-200">부모님/가족 케어 기능 무제한</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-[#d4af37] flex-shrink-0 mt-0.5" />
                  <span className="text-base md:text-lg text-gray-200">AI 닥터 도슨 무제한 질문</span>
                </div>
              </div>

              <button
                onClick={handleVIPClick}
                disabled={isProcessing}
                className="w-full py-3 px-4 bg-[#d4af37] hover:bg-[#e5c04a] text-[#1a1a1a] rounded-lg font-bold text-base md:text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isProcessing ? '처리 중...' : 'VIP 구독 시작하기'}
              </button>
            </div>
          </div>

          {/* 하단: 추천인 코드 링크 */}
          <div className="text-center pt-4 border-t border-gray-200">
            <button
              onClick={onReferralCode}
              className="text-base md:text-lg text-[#2DD4BF] hover:text-[#2DD4BF]/80 underline font-medium transition-colors"
            >
              추천인 코드 입력 시 추가 할인
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
