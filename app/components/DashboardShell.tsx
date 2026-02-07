'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import DashboardSidebar, { type SidebarMenuId } from './DashboardSidebar'
import DetailSlidePanel from './DetailSlidePanel'
import FamilyCareDetail from './detail-views/FamilyCareDetail'
import BriefingNoteDetail from './detail-views/BriefingNoteDetail'
import PrecisionAnalysisDetail from './detail-views/PrecisionAnalysisDetail'
import ServiceSettingsDetail from './detail-views/ServiceSettingsDetail'
import NotificationSettingsCard from './NotificationSettingsCard'

const MENU_TITLES: Record<NonNullable<SidebarMenuId>, string> = {
  'family-care': '가족/지인 케어',
  'briefing-note': '진료 브리핑 노트',
  'analysis-report': '정밀 분석 리포트',
  'health-notifications': '건강알림',
  'service-settings': '서비스 설정',
}

interface DashboardShellProps {
  children: React.ReactNode
  userId?: string
}

export default function DashboardShell({ children, userId }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [detailPanel, setDetailPanel] = useState<SidebarMenuId>(null)

  const renderDetailContent = () => {
    switch (detailPanel) {
      case 'family-care':
        return <FamilyCareDetail />
      case 'briefing-note':
        return <BriefingNoteDetail />
      case 'analysis-report':
        return <PrecisionAnalysisDetail />
      case 'health-notifications':
        return (
          <div className="p-4">
            <NotificationSettingsCard userId={userId} />
          </div>
        )
      case 'service-settings':
        return <ServiceSettingsDetail userId={userId} />
      default:
        return null
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* 햄버거 버튼 (고정) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-[#2DD4BF] text-gray-700 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 오버레이 사이드바 */}
      <DashboardSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectMenu={(id) => setDetailPanel(id)}
      />

      {/* 상세 패널 (오른쪽에서 슬라이드) */}
      <DetailSlidePanel
        isOpen={!!detailPanel}
        title={detailPanel ? MENU_TITLES[detailPanel] : ''}
        onClose={() => setDetailPanel(null)}
      >
        {renderDetailContent()}
      </DetailSlidePanel>

      {/* 메인 콘텐츠 (햄버거 버튼 공간 확보) */}
      <div className="pl-14">
        {children}
      </div>
    </div>
  )
}
