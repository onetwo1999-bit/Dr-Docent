/**
 * DNI(약-영양소 상호작용) 체크 전용 API.
 * 식단 사진 분석 결과(음식 목록) 또는 음식명 목록을 받아 USDA 조회 후 복용 약과 비교해
 * '데이터 기반 주의 가이드'만 반환. (확진·진단 아님)
 *
 * POST body: { foodNames: string[] }  (예: ["바나나", "시금치"])
 * 응답: { hasConflict, cautionGuideMessage, conflicts }
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { searchAndGetNutrients } from '@/lib/usda'
import { runDniInference } from '@/lib/dni-inference'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const foodNames = body?.foodNames
    if (!Array.isArray(foodNames) || foodNames.length === 0) {
      return NextResponse.json(
        { error: 'foodNames 배열 필수 (예: ["바나나", "시금치"])' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            try { cookiesToSet.forEach((c) => cookieStore.set(c.name, c.value, c.options)) } catch {}
          },
        },
      }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const usdaKey = (process.env.NEXT_PUBLIC_USDA_KEY ?? '').trim()
    if (!usdaKey) {
      return NextResponse.json(
        { hasConflict: false, cautionGuideMessage: null, conflicts: [], error: 'USDA API 키 미설정' },
        { status: 200 }
      )
    }

    const names = foodNames.slice(0, 5).map((n: unknown) => String(n).trim()).filter(Boolean)
    const usdaItems: { description: string; nutrients: import('@/lib/usda').UsdaNutrientsPer100g }[] = []
    for (const name of names) {
      const items = await searchAndGetNutrients(usdaKey, name, 1).catch(() => [])
      usdaItems.push(...items)
    }

    if (usdaItems.length === 0) {
      return NextResponse.json({
        hasConflict: false,
        cautionGuideMessage: null,
        conflicts: [],
      })
    }

    const admin = createAdminClient()
    const result = await runDniInference(admin, user.id, usdaItems)
    return NextResponse.json({
      hasConflict: result.hasConflict,
      cautionGuideMessage: result.cautionGuideMessage,
      conflicts: result.conflicts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[dni/check]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
