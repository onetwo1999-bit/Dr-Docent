'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import OnboardingModal from './OnboardingModal'

interface Profile {
  age: number | null
  gender: string | null
  height: number | null
  weight: number | null
  conditions: string | null
  medications: string | null
  chronic_diseases?: string | null
  bmi?: number | null
}

interface DashboardClientProps {
  userId: string
  userName: string
  profile: Profile | null
  children: React.ReactNode
}

export default function DashboardClient({ userId, userName, profile, children }: DashboardClientProps) {
  const router = useRouter()
  // profile prop이 변경될 때마다 showOnboarding 상태 업데이트
  const [showOnboarding, setShowOnboarding] = useState(!profile?.height || !profile?.weight)

  // profile prop이 변경되면 온보딩 표시 여부 업데이트
  useEffect(() => {
    const hasCompleteProfile = profile?.height && profile?.weight
    setShowOnboarding(!hasCompleteProfile)
  }, [profile])

  const handleOnboardingComplete = () => {
    // 서버 컴포넌트 데이터 새로고침
    // useEffect가 profile prop 변경을 감지하여 showOnboarding 상태를 자동 업데이트
    router.refresh()
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
