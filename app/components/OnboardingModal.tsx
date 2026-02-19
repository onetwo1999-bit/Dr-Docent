'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Ruler, Pill, HeartPulse, Pencil, Check, ChevronRight, X, Plus
} from 'lucide-react'
import { useToast } from './Toast'
import BirthDateWheelPicker from './BirthDateWheelPicker'
import { createClient } from '@/utils/supabase/client'

// ─── 기저 질환 칩 목록 ──────────────────────────────────────────
const DISEASE_CHIPS = [
  '고혈압', '당뇨', '고지혈증', '통풍', '비만',
  '심장질환', '뇌졸중', '천식', '관절염', '골다공증',
  '갑상선 질환', '신장 질환', '간 질환', '없음',
]

interface OnboardingModalProps {
  userId: string
  userName: string
  onComplete: () => void
}

interface FormData {
  nickname: string
  birth_date: string
  gender: 'male' | 'female' | ''
  height: string
  weight: string
  diseases: string[]      // 멀티 선택 칩
  medicationText: string  // 자유 텍스트 (복용 약물)
}

const TOTAL_STEPS = 4

export default function OnboardingModal({ userId, userName, onComplete }: OnboardingModalProps) {
  const router = useRouter()
  const { showToast, ToastComponent } = useToast()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [data, setData] = useState<FormData>({
    nickname: userName === '새 사용자' || !userName ? '' : userName,
    birth_date: '',
    gender: '',
    height: '',
    weight: '',
    diseases: [],
    medicationText: '',
  })

  // ─── 헬퍼 ──────────────────────────────────────────────────
  const set = <K extends keyof FormData>(field: K, value: FormData[K]) =>
    setData(prev => ({ ...prev, [field]: value }))

  const toggleDisease = (chip: string) => {
    if (chip === '없음') {
      set('diseases', data.diseases.includes('없음') ? [] : ['없음'])
      return
    }
    const next = data.diseases.filter(d => d !== '없음')
    set('diseases', next.includes(chip) ? next.filter(d => d !== chip) : [...next, chip])
  }

  const canProceed = (): boolean => {
    if (step === 1) return true                                       // 닉네임은 선택
    if (step === 2) return !!(data.birth_date && data.gender)
    if (step === 3) return !!(data.height && data.weight)
    return true
  }

  // ─── 제출 ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()

      // 1. profiles 업데이트 (닉네임 + 기본 + 질환)
      const diseasesStr = data.diseases.includes('없음') || data.diseases.length === 0
        ? null
        : data.diseases.join(', ')

      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          nickname: data.nickname.trim() || null,
          birth_date: data.birth_date || null,
          gender: data.gender || null,
          height: parseFloat(data.height) || null,
          weight: parseFloat(data.weight) || null,
          conditions: diseasesStr,
          chronic_diseases: diseasesStr,
          medications: data.medicationText.trim() || null,
        }),
      })
      const profileResult = await profileRes.json()
      if (!profileRes.ok || !profileResult.success) {
        throw new Error(profileResult.error || '프로필 저장 실패')
      }

      // 2. vitals 삽입 — 키/몸무게
      const h = parseFloat(data.height)
      const w = parseFloat(data.weight)
      if (h > 0 && w > 0) {
        const { error: vitalsErr } = await supabase.from('vitals').insert({
          user_id: userId,
          type: 'body_composition',
          value1: h,
          value2: w,
          recorded_at: new Date().toISOString(),
        })
        if (vitalsErr) console.warn('⚠️ vitals 삽입 실패 (무시):', vitalsErr.message)
      }

      // 3. user_medications — 텍스트 기반으로 profiles.medications에만 저장
      //    (drug_master FK 없이 자유 입력, 추후 약물 검색 기능과 연동)

      showToast('건강 분석을 시작합니다 🎉', 'success')
      setTimeout(() => onComplete(), 900)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장에 실패했습니다'
      showToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── 단계별 라벨 & 아이콘 ──────────────────────────────────
  const stepMeta = [
    { label: '닉네임', icon: Pencil, desc: '앱에서 표시될 이름을 설정해주세요' },
    { label: '기본 정보', icon: User, desc: '생년월일과 성별을 알려주세요' },
    { label: '신체 정보', icon: Ruler, desc: '정확한 건강 분석을 위한 정보예요' },
    { label: '건강 상태', icon: Pill, desc: '기저 질환과 복용 약을 선택해주세요 (선택)' },
  ]
  const meta = stepMeta[step - 1]
  const StepIcon = meta.icon

  return (
    <>
      {ToastComponent}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">

          {/* ── 헤더 ── */}
          <div className="bg-[#2DD4BF] px-5 py-4 text-white flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5" />
                <span className="font-bold text-base">기초 건강 문진표</span>
              </div>
              {/* 단계 표시 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i + 1 <= step ? 'bg-white w-5' : 'bg-white/30 w-3'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                <StepIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{meta.label}</p>
                <p className="text-xs text-white/75 leading-tight">{meta.desc}</p>
              </div>
            </div>
          </div>

          {/* ── 본문 (스크롤 가능) ── */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

            {/* Step 1: 닉네임 */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-[#2DD4BF]/5 rounded-xl p-4 text-sm text-gray-600 leading-relaxed">
                  랭킹·그룹에서 표시될 닉네임입니다.<br />
                  나중에 설정에서 언제든 바꿀 수 있어요.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    닉네임 <span className="text-gray-400 font-normal">(선택, 2–16자)</span>
                  </label>
                  <input
                    type="text"
                    value={data.nickname}
                    onChange={e => set('nickname', e.target.value)}
                    placeholder="예: 건강왕철수"
                    maxLength={17}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
                  />
                  {data.nickname.trim().length > 0 && data.nickname.trim().length < 2 && (
                    <p className="text-xs text-red-400 mt-1">2자 이상 입력해주세요</p>
                  )}
                  {data.nickname.trim().length > 16 && (
                    <p className="text-xs text-red-400 mt-1">16자 이하로 입력해주세요</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: 기본 정보 */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">생년월일 <span className="text-red-400">*</span></label>
                  <BirthDateWheelPicker
                    value={data.birth_date}
                    onChange={v => set('birth_date', v)}
                    maxDate={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">성별 <span className="text-red-400">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['male', 'female'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => set('gender', g)}
                        className={`py-3 rounded-xl font-medium transition-colors ${
                          data.gender === g
                            ? 'bg-[#2DD4BF] text-white'
                            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-[#2DD4BF]'
                        }`}
                      >
                        {g === 'male' ? '남성' : '여성'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: 신체 정보 */}
            {step === 3 && (
              <div className="space-y-4">
                {[
                  { field: 'height' as const, label: '키 (cm)', placeholder: '예: 170', min: 50, max: 300 },
                  { field: 'weight' as const, label: '몸무게 (kg)', placeholder: '예: 65', min: 10, max: 500 },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {label} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={data[field]}
                      onChange={e => set(field, e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
                    />
                  </div>
                ))}
                {/* BMI 미리보기 */}
                {data.height && data.weight && (() => {
                  const h = parseFloat(data.height), w = parseFloat(data.weight)
                  if (!h || !w || h < 50 || h > 300 || w < 10 || w > 500) return null
                  const bmi = (w / Math.pow(h / 100, 2)).toFixed(1)
                  const cat = +bmi < 18.5 ? '저체중' : +bmi < 23 ? '정상' : +bmi < 25 ? '과체중' : '비만'
                  return (
                    <div className="flex items-center justify-between bg-[#2DD4BF]/5 rounded-xl px-4 py-3 text-sm">
                      <span className="text-gray-500">예상 BMI</span>
                      <span className="font-bold text-[#2DD4BF]">{bmi} <span className="text-gray-500 font-normal">({cat})</span></span>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Step 4: 건강 상태 */}
            {step === 4 && (
              <div className="space-y-4">
                {/* 기저 질환 칩 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기저 질환 <span className="text-gray-400 font-normal">(해당하는 항목 모두 선택)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DISEASE_CHIPS.map(chip => {
                      const selected = data.diseases.includes(chip)
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => toggleDisease(chip)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            selected
                              ? 'bg-[#2DD4BF] text-white border-[#2DD4BF]'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#2DD4BF]'
                          }`}
                        >
                          {selected && chip !== '없음' && <Check className="w-3 h-3" />}
                          {chip}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 복용 중인 약물 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    복용 중인 약물 <span className="text-gray-400 font-normal">(선택)</span>
                  </label>
                  <textarea
                    value={data.medicationText}
                    onChange={e => set('medicationText', e.target.value)}
                    placeholder="예: 혈압약, 오메가3, 비타민D&#10;없으면 비워두세요"
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent resize-none text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    약물-영양소 상호작용(DNI) 분석에 활용됩니다
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── 푸터 버튼 ── */}
          <div className="px-5 pb-5 pt-3 flex gap-2.5 flex-shrink-0 border-t border-gray-100">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-1"
              >
                다음 <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    저장 중…
                  </span>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> 완료
                  </>
                )}
              </button>
            )}
          </div>

          {/* 하단 안내 */}
          <p className="text-center text-xs text-gray-400 pb-4 px-5 flex-shrink-0">
            입력 정보는 글로벌 의료 가이드라인 기준으로 분석됩니다
          </p>
        </div>
      </div>
    </>
  )
}
