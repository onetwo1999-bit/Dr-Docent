import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getOtterState } from '@/lib/otter'

export const dynamic = 'force-dynamic'

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

// GET /api/otter/state
// 오늘 수달 상태 반환 (health_logs + sleep_logs 기반)
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const state = await getOtterState(supabase, user.id)
    return NextResponse.json(state)
  } catch (error) {
    console.error('[Otter State] 예외:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// POST /api/otter/state
// 수달 이름 설정 (otter_pets upsert)
export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const name: string = typeof body?.name === 'string' && body.name.trim().length > 0
      ? body.name.trim().slice(0, 20)
      : '도달이'

    const { error } = await supabase
      .from('otter_pets')
      .upsert({ user_id: user.id, name }, { onConflict: 'user_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ name })
  } catch (error) {
    console.error('[Otter State POST] 예외:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
