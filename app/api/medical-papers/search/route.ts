import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { searchRelevantPapers } from '@/lib/medical-papers/rag-search'

export const dynamic = 'force-dynamic'

/**
 * GET: 유저 질문에 맞는 논문 참조 검색
 * Query: ?query=...
 * 인증 필요
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')?.trim() || ''
    if (!query) {
      return NextResponse.json(
        { success: false, error: 'query 파라미터 필요', references: [] },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다', references: [] },
        { status: 401 }
      )
    }

    const chunks = await searchRelevantPapers(query, 10)

    const seen = new Map<string, { title: string; pmid: string | null; citation_count: number; tldr: string | null }>()
    for (const c of chunks) {
      const key = c.pmid || c.title
      if (seen.has(key)) continue
      seen.set(key, {
        title: c.title,
        pmid: c.pmid?.startsWith('hash-') ? null : c.pmid,
        citation_count: c.citation_count,
        tldr: c.tldr,
      })
    }

    const references = Array.from(seen.values())

    return NextResponse.json({ success: true, references })
  } catch (e) {
    console.error('❌ [medical-papers/search]', e)
    return NextResponse.json(
      { success: false, error: (e as Error).message, references: [] },
      { status: 500 }
    )
  }
}
