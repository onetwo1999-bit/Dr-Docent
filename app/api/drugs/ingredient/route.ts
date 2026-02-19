/**
 * 제품명으로 유효성분 조회. drug_master 캐시 → 없으면 주성분 API 호출 후 저장.
 * GET /api/drugs/ingredient?productName=타이레놀
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getDrugMasterByProductName } from '@/lib/mfds-drug-ingredient'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const productName = searchParams.get('productName')?.trim()
  if (!productName) {
    return NextResponse.json(
      { error: 'productName 쿼리 필수 (예: ?productName=타이레놀)' },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const result = await getDrugMasterByProductName(productName, admin)
    return NextResponse.json({
      rows: result.rows,
      fromCache: result.fromCache,
      ...(result.saved != null && { saved: result.saved }),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[drugs/ingredient]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
