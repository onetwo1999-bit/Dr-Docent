'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAppContextStore } from '@/store/useAppContextStore'

const pathLabels: Record<string, string> = {
  '/dashboard': '대시보드',
  '/profile': '기본 신체 지표(프로필)',
  '/chat': 'AI 분석 요약(채팅)',
  '/group': '그룹',
  '/calendar': '캘린더'
}

function getLabel(path: string): string {
  if (pathLabels[path]) return pathLabels[path]
  if (path.startsWith('/group')) return '그룹'
  if (path.startsWith('/calendar')) return '캘린더'
  return path || '홈'
}

export default function AppContextTracker() {
  const pathname = usePathname()
  const pushAction = useAppContextStore((s) => s.pushAction)
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    if (pathname == null) return
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    pushAction({
      type: 'navigation',
      label: getLabel(pathname),
      path: pathname
    })
  }, [pathname, pushAction])

  return null
}
