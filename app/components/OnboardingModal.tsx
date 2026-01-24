'use client'

import { useState } from 'react'
import { X, User, Ruler, Scale, Pill, HeartPulse } from 'lucide-react'

interface OnboardingModalProps {
  userId: string
  userName: string
  onComplete: () => void
}

interface ProfileData {
  age: string
  gender: 'male' | 'female' | ''
  height: string
  weight: string
  conditions: string
  medications: string
}

export default function OnboardingModal({ userId, userName, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [data, setData] = useState<ProfileData>({
    age: '',
    gender: '',
    height: '',
    weight: '',
    conditions: '',
    medications: ''
  })

  const handleChange = (field: keyof ProfileData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      console.log('📤 프로필 저장 시도:', { userId, data })
      
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          age: parseInt(data.age) || null,
          gender: data.gender || null,
          height: parseFloat(data.height) || null,
          weight: parseFloat(data.weight) || null,
          conditions: data.conditions || null,
          medications: data.medications || null
        })
      })

      const result = await response.json()
      console.log('📥 서버 응답:', result)

      if (response.ok) {
        console.log('✅ 프로필 저장 성공!')
        onComplete()
      } else {
        console.error('❌ 프로필 저장 실패:', result)
        
        // 에러 메시지 상세히 표시
        if (result.error?.includes('RLS') || result.error?.includes('policy')) {
          alert('권한 오류: Supabase에서 profiles 테이블의 RLS 정책을 확인해주세요.\n\n' + result.error)
        } else {
          alert(`프로필 저장 실패: ${result.error || '알 수 없는 오류'}`)
        }
      }
    } catch (error) {
      console.error('프로필 저장 에러:', error)
      alert('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return data.age && data.gender
    if (step === 2) return data.height && data.weight
    return true
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#006666] rounded-3xl w-full max-w-md border border-white/20 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-[#40E0D0] p-4 text-[#006666]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-6 h-6" />
              <h2 className="font-bold text-lg">건강 프로필 설정</h2>
            </div>
            <span className="text-sm font-medium">{step}/3</span>
          </div>
          <p className="text-sm mt-1 opacity-80">
            {userName}님의 맞춤 건강 분석을 위해 정보를 입력해주세요
          </p>
        </div>

        {/* 본문 */}
        <div className="p-6 text-white">
          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-[#40E0D0]" />
                기본 정보
              </h3>
              
              <div>
                <label className="block text-sm text-white/70 mb-2">나이</label>
                <input
                  type="number"
                  value={data.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  placeholder="예: 30"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#40E0D0]"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">성별</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'male')}
                    className={`py-3 rounded-xl font-medium transition-colors ${
                      data.gender === 'male'
                        ? 'bg-[#40E0D0] text-[#006666]'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'female')}
                    className={`py-3 rounded-xl font-medium transition-colors ${
                      data.gender === 'female'
                        ? 'bg-[#40E0D0] text-[#006666]'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    여성
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 신체 정보 */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-[#40E0D0]" />
                신체 정보
              </h3>
              
              <div>
                <label className="block text-sm text-white/70 mb-2">키 (cm)</label>
                <input
                  type="number"
                  value={data.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  placeholder="예: 170"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#40E0D0]"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">몸무게 (kg)</label>
                <input
                  type="number"
                  value={data.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  placeholder="예: 65"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#40E0D0]"
                />
              </div>
            </div>
          )}

          {/* Step 3: 건강 정보 */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#40E0D0]" />
                건강 정보 (선택)
              </h3>
              
              <div>
                <label className="block text-sm text-white/70 mb-2">기저 질환</label>
                <textarea
                  value={data.conditions}
                  onChange={(e) => handleChange('conditions', e.target.value)}
                  placeholder="예: 고혈압, 당뇨 (없으면 비워두세요)"
                  rows={2}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#40E0D0] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-2">복용 중인 약물</label>
                <textarea
                  value={data.medications}
                  onChange={(e) => handleChange('medications', e.target.value)}
                  placeholder="예: 혈압약, 비타민 (없으면 비워두세요)"
                  rows={2}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#40E0D0] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="p-6 pt-0 flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              이전
            </button>
          )}
          
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 bg-[#40E0D0] hover:bg-[#3BC9BB] disabled:bg-white/20 disabled:cursor-not-allowed text-[#006666] py-3 rounded-xl font-semibold transition-colors"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-[#40E0D0] hover:bg-[#3BC9BB] disabled:bg-white/20 disabled:cursor-not-allowed text-[#006666] py-3 rounded-xl font-semibold transition-colors"
            >
              {isSubmitting ? '저장 중...' : '완료'}
            </button>
          )}
        </div>

        {/* 글로벌 의료 기준 안내 */}
        <div className="px-6 pb-4">
          <p className="text-xs text-white/40 text-center">
            입력된 정보는 글로벌 의료 기준에 따라 분석됩니다
          </p>
        </div>
      </div>
    </div>
  )
}
