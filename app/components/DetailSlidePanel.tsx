'use client'

import { ChevronLeft } from 'lucide-react'

interface DetailSlidePanelProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function DetailSlidePanel({ isOpen, title, onClose, children }: DetailSlidePanelProps) {
  return (
    <>
      {/* 배경 딤 */}
      <div
        className={`fixed inset-0 bg-black/20 z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* 슬라이드 패널 (오른쪽 → 왼쪽) */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-out overflow-hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors flex items-center gap-1"
              aria-label="닫기"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">뒤로</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 truncate flex-1 text-center pr-12">
              {title}
            </h1>
          </header>

          {/* 컨텐츠 */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
