'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Ruler, Pill, HeartPulse } from 'lucide-react'
import Toast, { useToast } from './Toast'

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
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
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
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          age: parseInt(data.age) || null,
          gender: data.gender || null,
          height: parseFloat(data.height) || null,
          weight: parseFloat(data.weight) || null,
          conditions: data.conditions || null,
          chronic_diseases: data.conditions || null, // conditions를 chronic_diseases에도 매핑
          medications: data.medications || null
        })
      })

      const result = await response.json()
      console.log('📥 서버 응답:', result)

      // ✅ 핵심 수정: response.ok && result.success이면 warning이 있어도 성공으로 처리
      if (response.ok && result.success) {
        console.log('✅ 프로필 저장 성공!')
        console.log('📥 서버 응답:', result)
        
        // 성공 Toast 표시
        showToast(result.message || '프로필이 성공적으로 저장되었습니다!', 'success')
        
        // 경고 메시지가 있으면 콘솔에만 표시 (모달 닫기를 막지 않음)
        if (result.warning) {
          console.warn('⚠️', result.warning)
          // 경고도 Toast로 표시 (info 타입)
          showToast(result.warning, 'info')
        }
        
        // 약간의 지연 후 모달 닫기 및 리다이렉트 (Toast 표시 시간 확보)
        setTimeout(() => {
          // 완료 콜백 호출 (DashboardClient에서 모달 닫기 및 리다이렉트 처리)
          onComplete()
        }, 800) // Toast 표시 시간을 위해 800ms로 증가
      } else {
        console.error('❌ 프로필 저장 실패:', result)
        
        // SCHEMA_MISMATCH 에러에 대한 명확한 안내
        if (result.code === 'SCHEMA_MISMATCH') {
          alert(`프로필 저장 실패: ${result.error}\n\n${result.details || ''}\n\n해결 방법:\n1. Supabase 대시보드 접속\n2. SQL Editor 열기\n3. supabase/profiles-schema-update.sql 파일 내용 복사 후 실행`)
        } else if (result.error?.includes('RLS') || result.error?.includes('policy')) {
          alert('권한 오류: Supabase에서 profiles 테이블의 RLS 정책을 확인해주세요.\n\n' + result.error)
        } else {
          alert(`프로필 저장 실패: ${result.error || result.details || '알 수 없는 오류'}`)
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
    <>
      {ToastComponent}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md border border-gray-100 shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="bg-[#2DD4BF] p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-6 h-6" />
              <h2 className="font-bold text-lg">건강 프로필 설정</h2>
            </div>
            <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full">{step}/3</span>
          </div>
          <p className="text-sm mt-1 text-white/80">
            {userName}님의 맞춤 건강 분석을 위해 정보를 입력해주세요
          </p>
        </div>

        {/* 본문 */}
        <div className="p-6 text-gray-800">
          {/* Step 1: 기본 정보 */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-[#2DD4BF]" />
                기본 정보
              </h3>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">나이</label>
                <input
                  type="number"
                  value={data.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  placeholder="만 나이를 입력해주세요. 정확한 건강 분석을 위해 필요합니다 (예: 30)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">성별</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'male')}
                    className={`py-3 rounded-xl font-medium transition-colors ${
                      data.gender === 'male'
                        ? 'bg-[#2DD4BF] text-white'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-[#2DD4BF]'
                    }`}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('gender', 'female')}
                    className={`py-3 rounded-xl font-medium transition-colors ${
                      data.gender === 'female'
                        ? 'bg-[#2DD4BF] text-white'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-[#2DD4BF]'
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
                <Ruler className="w-5 h-5 text-[#2DD4BF]" />
                신체 정보
              </h3>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">키 (cm)</label>
                <input
                  type="number"
                  value={data.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  placeholder="정확한 BMI 계산을 위해 센티미터 단위로 입력해주세요 (예: 170cm)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">몸무게 (kg)</label>
                <input
                  type="number"
                  value={data.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  placeholder="현재 몸무게를 킬로그램 단위로 입력해주세요. 건강 점수 계산에 사용됩니다 (예: 65kg)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 3: 건강 정보 */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#2DD4BF]" />
                건강 정보 (선택)
              </h3>
              
              <div>
                <label className="block text-sm text-gray-500 mb-2">기저 질환</label>
                <textarea
                  value={data.conditions}
                  onChange={(e) => handleChange('conditions', e.target.value)}
                  placeholder="현재 관리 중인 질환이 있다면 입력해주세요. AI가 맞춤형 건강 조언을 제공하는 데 활용됩니다 (예: 고혈압, 당뇨, 없으면 비워두세요)"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-2">복용 중인 약물</label>
                <textarea
                  value={data.medications}
                  onChange={(e) => handleChange('medications', e.target.value)}
                  placeholder="정기적으로 복용하는 약물이나 보조제를 입력해주세요. 약물 간 상호작용 체크와 영양 분석에 사용됩니다 (예: 혈압약, 오메가3, 비타민D, 없으면 비워두세요)"
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent resize-none"
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
              className="flex-1 bg-white hover:bg-gray-50 text-gray-600 py-3 rounded-xl font-semibold transition-colors border border-gray-200"
            >
              이전
            </button>
          )}
          
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {isSubmitting ? '저장 중...' : '완료'}
            </button>
          )}
        </div>

        {/* 글로벌 의료 기준 안내 */}
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-400 text-center">
            입력된 정보는 글로벌 의료 기준에 따라 분석됩니다
          </p>
        </div>
      </div>
    </div>
    </>
  )
}
