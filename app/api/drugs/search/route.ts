/**
 * 식약처 e약은요 API로 제품명 검색 → 성공 시 drugs 테이블에 자동 저장
 * GET /api/drugs/search?itemName=타이레놀
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { searchDrugByProductNameAndSave } from '@/lib/mfds-drug-api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const itemName = searchParams.get('itemName')?.trim()
  if (!itemName) {
    return NextResponse.json(
      { error: 'itemName 쿼리 필수 (예: ?itemName=타이레놀)' },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const result = await searchDrugByProductNameAndSave(itemName, admin)
    return NextResponse.json({
      totalCount: result.totalCount,
      items: result.items,
      saved: result.saved,
      ...(result.error && { saveError: result.error }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[drugs/search]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
