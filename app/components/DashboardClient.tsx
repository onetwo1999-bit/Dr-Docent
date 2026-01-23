'use client'

import { useState } from 'react'
import OnboardingModal from './OnboardingModal'

interface Profile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
}

interface DashboardClientProps {
  userId: string
  userName: string
  profile: Profile | null
  children: React.ReactNode
}

export default function DashboardClient({ userId, userName, profile, children }: DashboardClientProps) {
  const [showOnboarding, setShowOnboarding] = useState(!profile?.height || !profile?.weight)
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(profile)

  const handleOnboardingComplete = () => {
    // 페이지 새로고침으로 최신 데이터 반영
    window.location.reload()
  }

  return (
    <>
      {children}
      
      {/* 온보딩 모달 */}
      {showOnboarding && (
        <OnboardingModal
          userId={userId}
          userName={userName}
          onComplete={handleOnboardingComplete}
        />
      )}
    </>
  )
}
