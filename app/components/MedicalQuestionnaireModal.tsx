'use client'

import { useState } from 'react'
import { X, FileText, Printer, Loader2, ChevronRight, ArrowLeft, ClipboardList } from 'lucide-react'

interface QSection {
  title: string
  content: string
}

interface QuestionnaireResult {
  id?: string
  visit_purpose: string
  summary_json: {
    general: { sections: QSection[] }
    medical: { sections: QSection[] }
  }
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const QUICK_PURPOSES = ['내과 외래', '건강검진', '정형외과', '피부과', '신경과', '산부인과']

export default function MedicalQuestionnaireModal({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<'input' | 'generating' | 'result'>('input')
  const [visitPurpose, setVisitPurpose] = useState('')
  const [result, setResult] = useState<QuestionnaireResult | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'medical'>('general')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setStep('input')
    setVisitPurpose('')
    setResult(null)
    setError(null)
    onClose()
  }

  const handleGenerate = async () => {
    if (!visitPurpose.trim() || step === 'generating') return
    setStep('generating')
    setError(null)
    try {
      const res = await fetch('/api/questionnaire/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visit_purpose: visitPurpose.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '문진표 생성에 실패했습니다')
        setStep('input')
        return
      }
      setResult(data)
      setActiveTab('general')
      setStep('result')
    } catch {
      setError('네트워크 오류가 발생했습니다')
      setStep('input')
    }
  }

  const currentSections = result?.summary_json[activeTab]?.sections ?? []

  const createdAtLabel = result
    ? new Date(result.created_at).toLocaleString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : ''

  return (
    <>
      {/* ───── 화면 모달 (인쇄 시 숨김) ───── */}
      <div className="print:hidden">
        {/* 오버레이 */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          onClick={handleClose}
        />

        {/* 모달 */}
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                {step === 'result' && (
                  <button
                    onClick={() => setStep('input')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">문진표 발급</h2>
                  <p className="text-xs text-gray-400">Medical Questionnaire</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto">

              {/* ── 입력 / 생성중 단계 ── */}
              {(step === 'input' || step === 'generating') && (
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      방문 목적
                    </label>
                    <input
                      type="text"
                      value={visitPurpose}
                      onChange={e => setVisitPurpose(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                      placeholder="예: 내과 외래, 건강검진, 정형외과 상담..."
                      disabled={step === 'generating'}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-2">빠른 선택</p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PURPOSES.map(p => (
                        <button
                          key={p}
                          onClick={() => setVisitPurpose(p)}
                          disabled={step === 'generating'}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            visitPurpose === p
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                    <p className="font-semibold text-orange-600 mb-1.5">문진표 생성 시 사용 정보</p>
                    <p>· 프로필: 나이, 키, 몸무게, BMI, 기저질환</p>
                    <p>· 최근 30일 건강 기록 (식사·운동·복약·수면)</p>
                    <p>· 복용 중인 약물·영양제</p>
                  </div>

                  {step === 'generating' ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
                      <p className="text-sm text-gray-600 font-medium">AI가 문진표를 작성하고 있어요...</p>
                      <p className="text-xs text-gray-400">보통 10~20초 소요됩니다</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={!visitPurpose.trim()}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <FileText className="w-5 h-5" />
                      문진표 생성하기
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* ── 결과 단계 ── */}
              {step === 'result' && result && (
                <div>
                  {/* 탭 */}
                  <div className="flex border-b border-gray-100 px-4 pt-3 gap-0">
                    {(['general', 'medical'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                          activeTab === tab
                            ? 'text-orange-500 border-orange-500'
                            : 'text-gray-400 border-transparent hover:text-gray-600'
                        }`}
                      >
                        {tab === 'general' ? '일반인용' : '의료진용'}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 space-y-3">
                    {/* 방문 목적 배지 */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                        {result.visit_purpose}
                      </span>
                      <span className="text-xs text-gray-400">{createdAtLabel}</span>
                    </div>

                    {/* 섹션들 */}
                    {currentSections.map((section, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                        <div className={`px-4 py-2.5 ${activeTab === 'general' ? 'bg-orange-50' : 'bg-gray-50'}`}>
                          <h3 className={`font-bold text-sm ${activeTab === 'general' ? 'text-orange-700' : 'text-gray-700'}`}>
                            {section.title}
                          </h3>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {section.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 하단 고정 영역 */}
            {step === 'result' && result && (
              <div className="border-t border-gray-100 p-4 space-y-3 flex-shrink-0">
                <button
                  onClick={() => window.print()}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  인쇄하기
                </button>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  본 문서는 의료 진단 목적이 아니며, 정확한 진단은 전문의와 상담하세요
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───── 인쇄 전용 뷰 (화면에서는 숨김) ───── */}
      {step === 'result' && result && (
        <div className="hidden print:block p-8 max-w-3xl mx-auto font-sans">
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {activeTab === 'general' ? '문진표 (일반인용)' : 'Medical Questionnaire (의료진용)'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">방문 목적: {result.visit_purpose}</p>
            <p className="text-xs text-gray-400 mt-0.5">생성: {createdAtLabel}</p>
          </div>

          {currentSections.map((section, i) => (
            <div key={i} className="mb-6">
              <h2 className="font-bold text-gray-900 text-base border-b border-gray-300 pb-1 mb-2">
                {section.title}
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}

          <div className="mt-12 pt-4 border-t border-gray-300">
            <p className="text-xs text-gray-500 text-center">
              본 문서는 의료 진단 목적이 아니며, 정확한 진단은 전문의와 상담하세요
            </p>
          </div>
        </div>
      )}
    </>
  )
}
