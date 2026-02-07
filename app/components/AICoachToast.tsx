'use client'

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'

interface AICoachToastProps {
  /** 토스트가 표시될 때만 렌더링되므로, 상단 고정용 컨테이너에 배치 */
  className?: string
}

export default function AICoachToast({ className = '' }: AICoachToastProps) {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail
      const msg = detail?.message
      if (msg) {
        setMessage(msg)
        setVisible(true)
        const t = setTimeout(() => setVisible(false), 5000)
        return () => clearTimeout(t)
      }
    }
    window.addEventListener('ai-coach-toast', handler)
    return () => window.removeEventListener('ai-coach-toast', handler)
  }, [])

  const handleClick = () => {
    setVisible(false)
    window.dispatchEvent(new CustomEvent('open-health-report-modal'))
  }

  if (!visible || !message) return null

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-2rem)] w-full max-w-md ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center gap-3 p-4 rounded-xl bg-white border border-[#2DD4BF]/30 shadow-lg hover:shadow-md hover:border-[#2DD4BF]/50 transition-all text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-[#2DD4BF]/10 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-[#2DD4BF]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#2DD4BF]">AI 코치의 한마디</p>
          <p className="text-sm font-medium text-gray-800 line-clamp-2">{message}</p>
          <p className="text-xs text-gray-500 mt-0.5">탭하면 건강 리포트 보기</p>
        </div>
      </button>
    </div>
  )
}
