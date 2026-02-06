'use client'

import RankingBoard from './RankingBoard'

/** 랭킹 보드 (Realtime 동기화는 RankingBoard 내부에서 처리) */
export default function DashboardRankingSection() {
  return (
    <div className="w-full">
      <RankingBoard />
    </div>
  )
}
