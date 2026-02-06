'use client'

import { AlertTriangle } from 'lucide-react'

interface MedicalDisclaimerProps {
  variant?: 'compact' | 'full'
  className?: string
}

export default function MedicalDisclaimer({ variant = 'full', className = '' }: MedicalDisclaimerProps) {
  const disclaimerText = '본 서비스는 의료 진단 목적이 아니며, 자세한 사항은 전문의와 상의하십시오.'

  if (variant === 'compact') {
    return (
      <div className={`flex items-start gap-2 text-xs text-gray-500 ${className}`}>
        <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">{disclaimerText}</p>
      </div>
    )
  }

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-900 leading-relaxed font-medium">
            {disclaimerText}
          </p>
        </div>
      </div>
    </div>
  )
}
