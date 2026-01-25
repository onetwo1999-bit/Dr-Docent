'use client'

import { useState } from 'react'
import { Check, X, Loader2, RefreshCw, Utensils, Dumbbell, Pill, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'running'
  message: string
  details?: any
}

export default function TestHealthLogsPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number } | null>(null)

  const runTests = async () => {
    setIsRunning(true)
    setResults([])
    setSummary(null)

    try {
      const response = await fetch('/api/health-logs/test')
      const data = await response.json()

      setResults(data.tests || [])
      setSummary(data.summary || { total: 0, passed: 0, failed: 0 })
    } catch (error) {
      console.error('테스트 실행 실패:', error)
      setResults([{
        name: '테스트 실행',
        status: 'fail',
        message: '테스트 API 호출 실패',
        details: { error: String(error) }
      }])
    } finally {
      setIsRunning(false)
    }
  }

  const testButtonClick = async (category: 'meal' | 'exercise' | 'medication') => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/health-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category,
          note: `테스트 기록 (${category})`
        })
      })

      const data = await response.json()
      
      if (data.success) {
        alert(`✅ ${category === 'meal' ? '식사' : category === 'exercise' ? '운동' : '복약'} 기록이 성공적으로 저장되었습니다!\n\nID: ${data.data.id}\n시간: ${new Date(data.data.logged_at).toLocaleString('ko-KR')}`)
      } else {
        alert(`❌ 저장 실패: ${data.error}\n\n${data.hint || ''}`)
      }
    } catch (error) {
      alert(`❌ 네트워크 오류: ${String(error)}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard" className="text-gray-400 hover:text-[#2DD4BF]">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Health Logs 테스트</h1>
            <p className="text-sm text-gray-400">health_logs 테이블 연결 및 데이터 저장 확인</p>
          </div>
        </div>

        {/* 자동 테스트 섹션 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">자동 테스트</h2>
              <p className="text-sm text-gray-400">모든 기능을 자동으로 테스트합니다</p>
            </div>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="px-4 py-2 bg-[#2DD4BF] text-white rounded-xl font-medium hover:bg-[#26b8a5] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  테스트 실행 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  테스트 실행
                </>
              )}
            </button>
          </div>

          {/* 테스트 결과 */}
          {results.length > 0 && (
            <div className="space-y-3 mt-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${
                    result.status === 'pass'
                      ? 'bg-green-50 border-green-200'
                      : result.status === 'fail'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.status === 'pass' ? (
                      <Check className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : result.status === 'fail' ? (
                      <X className="w-5 h-5 text-red-600 mt-0.5" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-gray-400 mt-0.5 animate-spin" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">{result.name}</div>
                      <div className="text-sm text-gray-600">{result.message}</div>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                            상세 정보 보기
                          </summary>
                          <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 요약 */}
          {summary && (
            <div className={`mt-4 p-4 rounded-xl ${
              summary.failed === 0
                ? 'bg-[#2DD4BF]/10 border border-[#2DD4BF]'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">
                    {summary.failed === 0 ? '✅ 모든 테스트 통과!' : `⚠️ ${summary.failed}개 실패`}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    총 {summary.total}개 중 {summary.passed}개 성공, {summary.failed}개 실패
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#2DD4BF]">
                  {Math.round((summary.passed / summary.total) * 100)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 수동 테스트 섹션 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">수동 테스트</h2>
          <p className="text-sm text-gray-400 mb-4">각 버튼을 클릭하여 실제로 데이터가 저장되는지 확인하세요</p>

          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => testButtonClick('meal')}
              disabled={isRunning}
              className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-all disabled:opacity-50"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                <Utensils className="w-6 h-6 text-orange-500" />
              </div>
              <span className="font-medium text-gray-900">식사 기록</span>
              <span className="text-xs text-gray-400 mt-1">테스트 저장</span>
            </button>

            <button
              onClick={() => testButtonClick('exercise')}
              disabled={isRunning}
              className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-all disabled:opacity-50"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <Dumbbell className="w-6 h-6 text-blue-500" />
              </div>
              <span className="font-medium text-gray-900">운동 기록</span>
              <span className="text-xs text-gray-400 mt-1">테스트 저장</span>
            </button>

            <button
              onClick={() => testButtonClick('medication')}
              disabled={isRunning}
              className="flex flex-col items-center justify-center p-6 rounded-xl border border-gray-200 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-all disabled:opacity-50"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                <Pill className="w-6 h-6 text-purple-500" />
              </div>
              <span className="font-medium text-gray-900">복약 기록</span>
              <span className="text-xs text-gray-400 mt-1">테스트 저장</span>
            </button>
          </div>
        </div>

        {/* 안내 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">📋 테스트 체크리스트</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✅ Supabase에서 schema-v2.sql 실행 완료</li>
            <li>✅ health_logs 테이블 생성 확인</li>
            <li>✅ RLS 정책 설정 확인</li>
            <li>✅ 로그인 상태 확인</li>
            <li>✅ 자동 테스트 실행 및 모든 항목 통과</li>
            <li>✅ 수동 테스트로 실제 데이터 저장 확인</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
