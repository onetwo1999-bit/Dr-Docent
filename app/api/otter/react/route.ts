import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { OtterActionType } from '@/lib/otter'

export const dynamic = 'force-dynamic'

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

const ACTION_PROMPTS: Record<OtterActionType, string> = {
  feed: '사용자가 오늘 식사를 기록했어. 수달이 밥을 받아먹고 행복해하는 반응을 써줘.',
  walk: '사용자가 오늘 운동을 기록했어. 수달이 산책을 마치고 신나는 반응을 써줘.',
  sleep: '사용자가 오늘 수면을 기록했어. 수달이 푹 자고 일어나서 개운한 반응을 써줘.',
  supplement: '사용자가 오늘 영양제를 기록했어. 수달이 영양제를 받고 건강해진 반응을 써줘.',
}

const SYSTEM_PROMPT = `너는 '도달이'라는 이름의 귀여운 수달 캐릭터야.
사용자의 건강 기록에 맞춰 짧고 귀여운 반응 텍스트를 생성해.

규칙:
- 1~2문장, 30자 이내로 짧게
- 수달 특유의 귀여운 말투 (예: ~냥, ~이에요, ~해요)
- 이모지 1개만 포함
- 건강 기록을 칭찬하고 격려하는 내용
- 한국어로만 작성`

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

function getTodayKST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'JSON 형식 오류' }, { status: 400 })
    }

    const { action_type, health_log_id } = body as {
      action_type: OtterActionType
      health_log_id?: string
    }

    const validActions: OtterActionType[] = ['feed', 'walk', 'sleep', 'supplement']
    if (!validActions.includes(action_type)) {
      return NextResponse.json({ error: '유효하지 않은 action_type' }, { status: 400 })
    }

    const today = getTodayKST()

    // 오늘 이미 생성된 반응이 있으면 캐시 반환
    const { data: cached } = await supabase
      .from('otter_reactions')
      .select('reaction_text')
      .eq('user_id', user.id)
      .eq('action_type', action_type)
      .eq('reacted_date', today)
      .maybeSingle()

    if (cached) {
      return NextResponse.json({ reaction_text: cached.reaction_text, cached: true })
    }

    // GPT-4o mini 호출
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다' }, { status: 500 })
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: ACTION_PROMPTS[action_type] },
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('[Otter React] OpenAI 오류:', openaiRes.status, errText.slice(0, 200))
      return NextResponse.json({ error: 'AI 응답 생성 실패' }, { status: 502 })
    }

    const openaiData = await openaiRes.json()
    const reaction_text: string = openaiData?.choices?.[0]?.message?.content?.trim() ?? '도달이가 기뻐해요! 🦦'

    // otter_reactions에 저장 (UNIQUE 충돌 시 무시)
    await supabase
      .from('otter_reactions')
      .upsert(
        {
          user_id: user.id,
          action_type,
          reaction_text,
          health_log_id: health_log_id ?? null,
          reacted_date: today,
        },
        { onConflict: 'user_id,action_type,reacted_date', ignoreDuplicates: false }
      )

    return NextResponse.json({ reaction_text, cached: false })
  } catch (error) {
    console.error('[Otter React] 예외:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
