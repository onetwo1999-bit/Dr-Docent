'use client'

import Link from 'next/link'
import { MessageSquare, ArrowRight } from 'lucide-react'

export default function BriefingNoteDetail() {
  return (
    <div className="p-6">
      <div className="rounded-xl border-2 border-[#2DD4BF]/20 bg-[#2DD4BF]/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#2DD4BF]/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-6 h-6 text-[#2DD4BF]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 mb-1">AI 상담 브리핑</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              닥터 도슨 AI와의 대화 내용을 기반으로 진료 브리핑 노트를 확인하실 수 있습니다.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 text-[#2DD4BF] font-medium text-sm hover:underline"
            >
              AI 상담으로 이동
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-600">
          진료 브리핑 노트는 AI 상담 내역을 요약하여 담당 의사나 가족과 공유할 때 유용합니다.
          상담 기록은 향후 업데이트 예정입니다.
        </p>
      </div>
    </div>
  )
}
