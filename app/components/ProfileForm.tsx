'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, User, Ruler, Pill } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

interface ProfileFormProps {
  userId: string
  userName: string
  initialProfile: Profile | null
}

export default function ProfileForm({ userId, userName, initialProfile }: ProfileFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [data, setData] = useState({
    age: initialProfile?.age?.toString() || '',
    gender: initialProfile?.gender || '',
    height: initialProfile?.height?.toString() || '',
    weight: initialProfile?.weight?.toString() || '',
    conditions: initialProfile?.conditions || '',
    medications: initialProfile?.medications || ''
  })

  const handleChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
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
          chronic_diseases: data.conditions || null, // conditions를 chronic_diseases에도 저장
          medications: data.medications || null
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // 성공 메시지 표시
        console.log('✅ 프로필 저장 성공:', result)
        // 대시보드로 이동 및 새로고침
        router.push('/dashboard')
        router.refresh()
      } else {
        console.error('❌ 프로필 저장 실패:', result)
        alert(result.error || result.details || '프로필 저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('프로필 저장 에러:', error)
      alert('프로필 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl w-full max-w-md border border-gray-100 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="bg-[#2DD4BF] p-4 text-white">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:bg-white/20 p-1 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg">건강 프로필 수정</h1>
            <p className="text-sm text-white/80">{userName}님의 건강 정보</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* 기본 정보 */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-gray-900">
            <User className="w-5 h-5 text-[#2DD4BF]" />
            기본 정보
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-2">나이</label>
              <input
                type="number"
                value={data.age}
                onChange={(e) => handleChange('age', e.target.value)}
                placeholder="30"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-2">성별</label>
              <select
                value={data.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
              >
                <option value="">선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
          </div>
        </div>

        {/* 신체 정보 */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-gray-900">
            <Ruler className="w-5 h-5 text-[#2DD4BF]" />
            신체 정보
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-2">키 (cm)</label>
              <input
                type="number"
                value={data.height}
                onChange={(e) => handleChange('height', e.target.value)}
                placeholder="170"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-500 mb-2">몸무게 (kg)</label>
              <input
                type="number"
                value={data.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
                placeholder="65"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 건강 정보 */}
        <div className="space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-gray-900">
            <Pill className="w-5 h-5 text-[#2DD4BF]" />
            건강 정보
          </h3>
          
          <div>
            <label className="block text-sm text-gray-500 mb-2">기저 질환</label>
            <textarea
              value={data.conditions}
              onChange={(e) => handleChange('conditions', e.target.value)}
              placeholder="예: 고혈압, 당뇨 (없으면 비워두세요)"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-2">복용 중인 약물</label>
            <textarea
              value={data.medications}
              onChange={(e) => handleChange('medications', e.target.value)}
              placeholder="예: 혈압약, 비타민 (없으면 비워두세요)"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#2DD4BF] hover:bg-[#26b8a5] disabled:bg-gray-200 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Save className="w-5 h-5" />
          {isSubmitting ? '저장 중...' : '변경사항 저장'}
        </button>

        {/* 안내 문구 */}
        <p className="text-xs text-gray-400 text-center">
          입력된 정보는 글로벌 의료 기준에 따라 분석됩니다
        </p>
      </form>
    </div>
  )
}
