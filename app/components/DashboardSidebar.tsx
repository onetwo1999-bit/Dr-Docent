'use client'

import { useState } from 'react'
import {
  X,
  Users,
  FileText,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export type SidebarMenuId = 'family-care' | 'briefing-note' | 'analysis-report' | 'health-notifications' | 'service-settings' | null

const MENU_ITEMS: { id: SidebarMenuId; label: string; icon: React.ReactNode }[] = [
  { id: 'family-care', label: '가족/지인 케어', icon: <Users className="w-5 h-5" /> },
  { id: 'briefing-note', label: '진료 브리핑 노트', icon: <FileText className="w-5 h-5" /> },
  { id: 'analysis-report', label: '정밀 분석 리포트', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'health-notifications', label: '건강알림', icon: <Bell className="w-5 h-5" /> },
  { id: 'service-settings', label: '서비스 설정', icon: <Settings className="w-5 h-5" /> },
]

const LOGOUT_FAREWELL = '오늘도 건강한 하루를 위해 애쓰셨습니다. 내일 또 뵙겠습니다!'

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectMenu: (id: SidebarMenuId) => void
}

function clearSupabaseCookies() {
  if (typeof document === 'undefined') return
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim()
    if (name.startsWith('sb-') || name.includes('supabase')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    }
  })
}

export default function DashboardSidebar({ isOpen, onClose, onSelectMenu }: DashboardSidebarProps) {
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleSelect = (id: SidebarMenuId) => {
    if (id) {
      onSelectMenu(id)
      onClose()
    }
  }

  const handleLogoutClick = () => {
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      clearSupabaseCookies()
      onClose()
      window.location.href = '/'
    } catch (e) {
      console.error('로그아웃 오류:', e)
      clearSupabaseCookies()
      window.location.href = '/'
    } finally {
      setIsLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  const handleLogoutCancel = () => {
    if (!isLoggingOut) setShowLogoutModal(false)
  }

  return (
    <>
      {/* 배경 딤 (오버레이) */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* 사이드바 패널 (오버레이) */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white shadow-xl z-50 w-64 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#2DD4BF]/10 flex items-center justify-center">
                <span className="text-[#2DD4BF] font-bold text-sm">D</span>
              </div>
              <span className="font-semibold text-gray-900">닥터 도슨</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="사이드바 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 메뉴 항목 */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#2DD4BF]/10 hover:text-[#26b8a5] text-gray-700 transition-colors"
              >
                <span className="text-gray-500 flex-shrink-0">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* 로그아웃 버튼 (하단 고정, 시각적 구분) */}
          <div className="mt-auto p-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200 transition-colors font-medium text-sm"
              aria-label="로그아웃"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* AI 코치 작별 인사 확인 모달 */}
      {showLogoutModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={handleLogoutCancel}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
            <p className="text-gray-700 text-center leading-relaxed mb-6">
              {LOGOUT_FAREWELL}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLogoutCancel}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-xl bg-[#2DD4BF] text-white font-medium text-sm hover:bg-[#26b8a5] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    로그아웃 중...
                  </>
                ) : (
                  '로그아웃'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
