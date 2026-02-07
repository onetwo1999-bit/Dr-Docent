'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import GroupSafetyCalendar from '../GroupSafetyCalendar'
import { Loader2, Users } from 'lucide-react'

export default function FamilyCareDetail() {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setError('로그인이 필요합니다.')
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
            setError('차트 번호가 없습니다.')
            setLoading(false)
            return
          }

          supabase
            .from('user_groups')
            .select('group_id')
            .contains('member_chart_numbers', [profile.chart_number])
            .limit(1)
            .single()
            .then(({ data: group }) => {
              if (group) setGroupId(group.group_id)
              else setError('가입한 그룹이 없습니다.')
            })
            .finally(() => setLoading(false))
        })
    })
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-[#2DD4BF] animate-spin" />
        <p className="mt-3 text-sm text-gray-500">불러오는 중...</p>
      </div>
    )
  }

  if (error || !groupId) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl">
          <Users className="w-8 h-8 text-amber-500" />
          <div>
            <p className="font-medium text-amber-800">{error || '그룹이 없습니다.'}</p>
            <p className="text-sm text-amber-600 mt-1">
              가족/지인과 그룹을 만들어 건강 기록을 함께 확인해보세요.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <GroupSafetyCalendar groupId={groupId} />
    </div>
  )
}
