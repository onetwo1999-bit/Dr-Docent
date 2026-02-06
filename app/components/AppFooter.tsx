'use client'

import { usePathname } from 'next/navigation'
import MedicalDisclaimer from './MedicalDisclaimer'

export default function AppFooter() {
  const pathname = usePathname()
  
  // 랜딩 페이지는 이미 면책 조항이 있으므로 제외
  if (pathname === '/') {
    return null
  }

  return (
    <footer className="border-t border-gray-200 bg-white py-6 px-4 mt-auto">
      <div className="max-w-7xl mx-auto">
        <MedicalDisclaimer variant="full" />
      </div>
    </footer>
  )
}
