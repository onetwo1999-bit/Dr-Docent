'use client'

import { useState } from 'react'
import {
  Menu,
  X,
  Users,
  FileText,
  BarChart3,
  Settings,
  Bell,
} from 'lucide-react'

export type SidebarMenuId = 'family-care' | 'briefing-note' | 'analysis-report' | 'health-notifications' | 'service-settings' | null

const MENU_ITEMS: { id: SidebarMenuId; label: string; icon: React.ReactNode }[] = [
  { id: 'family-care', label: '가족/지인 케어', icon: <Users className="w-5 h-5" /> },
  { id: 'briefing-note', label: '진료 브리핑 노트', icon: <FileText className="w-5 h-5" /> },
  { id: 'analysis-report', label: '정밀 분석 리포트', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'health-notifications', label: '건강알림', icon: <Bell className="w-5 h-5" /> },
  { id: 'service-settings', label: '서비스 설정', icon: <Settings className="w-5 h-5" /> },
]

interface DashboardSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectMenu: (id: SidebarMenuId) => void
}

export default function DashboardSidebar({ isOpen, onClose, onSelectMenu }: DashboardSidebarProps) {
  const handleSelect = (id: SidebarMenuId) => {
    if (id) {
      onSelectMenu(id)
      onClose()
    }
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
        </div>
      </aside>
    </>
  )
}
