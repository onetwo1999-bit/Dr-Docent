import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings } from 'lucide-react'
import NicknameSettingsCard from '@/app/components/NicknameSettingsCard'

export const metadata = { title: '설정 — 닥터 도슨' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .single()

  const currentNickname: string | null = (profile as { nickname?: string | null } | null)?.nickname ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <h1 className="text-base font-semibold text-gray-900">설정</h1>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 섹션 레이블 */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
          계정 정보
        </p>

        {/* 닉네임 설정 카드 */}
        <NicknameSettingsCard userId={user.id} initialNickname={currentNickname} />

        {/* 건강 프로필 링크 */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
          건강 정보
        </p>
        <Link
          href="/profile"
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-colors group"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">건강 프로필 수정</p>
            <p className="text-xs text-gray-400 mt-0.5">나이·키·몸무게·기저질환·복용 약</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180 group-hover:text-[#2DD4BF] transition-colors" />
        </Link>
      </main>
    </div>
  )
}
