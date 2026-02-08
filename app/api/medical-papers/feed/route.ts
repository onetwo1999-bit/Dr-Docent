import { NextResponse } from 'next/server'
import { runFeedingPipeline } from '@/lib/medical-papers/feeding-pipeline'

export const dynamic = 'force-dynamic'

/**
 * POST: 유저 검색어로 논문 자동 피딩
 * Body: { query: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query 필수' },
        { status: 400 }
      )
    }

    const result = await runFeedingPipeline(query)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('❌ [medical-papers/feed]', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
