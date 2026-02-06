import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import GroupCalendar from '@/app/components/GroupCalendar'

interface PageProps {
  params: Promise<{ groupId: string }>
}

export default async function GroupCalendarPage({ params }: PageProps) {
  const { groupId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  let groupName: string | undefined
  const { data: group } = await supabase
    .from('user_groups')
    .select('group_id')
    .eq('group_id', groupId)
    .single()
  if (group) {
    groupName = group.group_id
  }

  return (
    <div className="min-h-screen bg-white">
      <GroupCalendar groupId={groupId} groupName={groupName} />
    </div>
  )
}
