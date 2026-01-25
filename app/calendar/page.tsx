import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CalendarView from '../components/CalendarView'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-white">
      <CalendarView userId={user.id} />
    </div>
  )
}
