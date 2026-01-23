'use client'

import { LogOut } from 'lucide-react'
import { signOut } from '../actions/auth'
import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'

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
      className="w-full bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
    >
      {isPending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          로그아웃 중...
        </>
      ) : (
        <>
          <LogOut className="w-5 h-5" />
          로그아웃
        </>
      )}
    </button>
  )
}
