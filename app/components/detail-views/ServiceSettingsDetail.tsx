'use client'

import Link from 'next/link'
import { User, ChevronRight } from 'lucide-react'
import NotificationSettingsCard from '../NotificationSettingsCard'

interface ServiceSettingsDetailProps {
  userId?: string
}

export default function ServiceSettingsDetail({ userId }: ServiceSettingsDetailProps) {
  return (
    <div className="p-4 space-y-6">
      <NotificationSettingsCard userId={userId} />

      <div className="space-y-2">
        <Link
          href="/profile"
          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">건강 프로필</p>
              <p className="text-xs text-gray-500">나이, 키, 몸무게 등 기본 정보</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>
    </div>
  )
}
