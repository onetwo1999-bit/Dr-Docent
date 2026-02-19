'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/app/components/Toast'
import { Pencil, Check, Loader2, User } from 'lucide-react'

interface NicknameSettingsCardProps {
  userId: string
  initialNickname: string | null
}

const MAX_LEN = 16
const MIN_LEN = 2

export default function NicknameSettingsCard({ userId, initialNickname }: NicknameSettingsCardProps) {
  const [nickname, setNickname] = useState(initialNickname ?? '')
  const [displayedNickname, setDisplayedNickname] = useState(initialNickname ?? '')
  const [isDirty, setIsDirty] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { showToast, ToastComponent } = useToast()

  const trimmed = nickname.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_LEN
  const tooLong = trimmed.length > MAX_LEN
  const unchanged = trimmed === displayedNickname
  const isDisabled = isPending || !isDirty || tooShort || tooLong || trimmed.length === 0 || unchanged

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value)
    setIsDirty(true)
  }

  const handleSave = () => {
    if (isDisabled) return
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('profiles')
          .update({ nickname: trimmed, updated_at: new Date().toISOString() })
          .eq('id', userId)

        if (error) throw error

        setDisplayedNickname(trimmed)
        setIsDirty(false)
        showToast('닉네임이 변경되었습니다', 'success')
      } catch (err) {
        const msg = err instanceof Error ? err.message : '저장에 실패했습니다'
        showToast(msg, 'error')
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave()
  }

  return (
    <>
      {ToastComponent}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* 카드 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-[#2DD4BF]/10 flex items-center justify-center">
            <User className="w-4 h-4 text-[#2DD4BF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">닉네임</p>
            <p className="text-xs text-gray-400">랭킹과 그룹에서 표시되는 이름</p>
          </div>
        </div>

        {/* 현재 닉네임 미리보기 */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-400">현재 닉네임</span>
            <span className="text-sm font-bold text-gray-800">
              {displayedNickname || <span className="text-gray-300 font-normal">미설정</span>}
            </span>
          </div>

          {/* 입력 + 버튼 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Pencil className="w-4 h-4 text-gray-300" />
              </div>
              <input
                type="text"
                value={nickname}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="새 닉네임 입력 (2–16자)"
                maxLength={MAX_LEN + 1}
                className={`w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border transition-colors outline-none
                  ${tooShort || tooLong
                    ? 'border-red-300 bg-red-50 focus:border-red-400'
                    : 'border-gray-200 bg-gray-50 focus:border-[#2DD4BF] focus:bg-white'
                  }`}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isDisabled}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${isDisabled
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-[#2DD4BF] text-white hover:bg-[#26b8a5] active:scale-95 shadow-sm'
                }`}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              저장
            </button>
          </div>

          {/* 유효성 메시지 */}
          <div className="mt-1.5 min-h-[1.1rem]">
            {tooShort && (
              <p className="text-xs text-red-500">닉네임은 {MIN_LEN}자 이상이어야 합니다.</p>
            )}
            {tooLong && (
              <p className="text-xs text-red-500">닉네임은 {MAX_LEN}자 이하여야 합니다.</p>
            )}
            {!tooShort && !tooLong && isDirty && !unchanged && trimmed.length > 0 && (
              <p className="text-xs text-[#2DD4BF]">Enter 또는 저장 버튼으로 반영</p>
            )}
            {isDirty && unchanged && trimmed.length > 0 && (
              <p className="text-xs text-gray-400">현재 닉네임과 동일합니다.</p>
            )}
          </div>
        </div>

        {/* 하단 글자수 */}
        <div className="px-5 pb-4 flex justify-end">
          <span className={`text-xs tabular-nums ${trimmed.length > MAX_LEN ? 'text-red-400' : 'text-gray-300'}`}>
            {trimmed.length} / {MAX_LEN}
          </span>
        </div>
      </div>
    </>
  )
}
