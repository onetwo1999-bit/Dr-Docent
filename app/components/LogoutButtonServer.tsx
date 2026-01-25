'use client'

import { LogOut, Loader2 } from 'lucide-react'
import { signOut } from '../actions/auth'
import { useTransition } from 'react'

export default function LogoutButtonServer() {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      await signOut()
    })
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-500 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-gray-200"
    >
      {isPending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-[#2DD4BF]" />
          로그아웃 중...
        </>
      ) : (
        <>
          <LogOut className="w-5 h-5 text-[#2DD4BF]" />
          로그아웃
        </>
      )}
    </button>
  )
}
