'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import GroupCalendar from './GroupCalendar'
import { Users, Loader2 } from 'lucide-react'

/** 그룹 캘린더 + Realtime 동기화 (group_activity_events 변경 시 자동 업데이트) */
export default function DashboardGroupSection() {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [groupName, setGroupName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    
    // 사용자가 속한 첫 번째 그룹 조회
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }
      
      supabase
        .from('profiles')
        .select('chart_number')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          if (!profile?.chart_number) {
            setLoading(false)
            setError('차트 번호가 없습니다. 프로필을 설정해주세요.')
            return
          }
          
          // 사용자의 차트 번호가 포함된 그룹 찾기
          supabase
            .from('user_groups')
            .select('group_id, member_chart_numbers')
            .contains('member_chart_numbers', [profile.chart_number])
            .limit(1)
            .single()
            .then(({ data: group, error: groupError }) => {
              if (groupError || !group) {
                setError('가입한 그룹이 없습니다.')
                setLoading(false)
                return
              }
              setGroupId(group.group_id)
              setGroupName(group.group_id)
              setLoading(false)
            })
        })
    })
  }, [])


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#2DD4BF] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">그룹 캘린더</h3>
        </div>
        <p className="text-gray-500 text-base">{error}</p>
      </div>
    )
  }

  if (!groupId) {
    return null
  }

  return (
    <div className="w-full">
      <GroupCalendar groupId={groupId} groupName={groupName || undefined} />
    </div>
  )
}
