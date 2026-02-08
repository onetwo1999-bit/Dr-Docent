/**
 * RAG: 유저 질문에 맞는 논문 청크 검색
 */

import OpenAI from 'openai'
import { createClient } from '@/utils/supabase/server'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const TOP_K = 5

export type PaperChunk = {
  id: string
  pmid: string | null
  title: string
  abstract: string | null
  citation_count: number
  tldr: string | null
  chunk_text: string
}

export async function searchRelevantPapers(
  query: string,
  topK = TOP_K
): Promise<PaperChunk[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return []

  const openai = new OpenAI({ apiKey: openaiKey })
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query.slice(0, 8000),
  })
  const embedding = res.data[0]?.embedding
  if (!embedding) return []

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('match_medical_papers', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: topK,
  })

  if (error) {
    const fallback = await fallbackSearch(supabase, query, topK)
    return fallback
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    pmid: r.pmid,
    title: r.title ?? '',
    abstract: r.abstract,
    citation_count: r.citation_count ?? 0,
    tldr: r.tldr,
    chunk_text: r.chunk_text ?? '',
  }))
}

/** RPC가 없을 때 텍스트 검색으로 대체 */
async function fallbackSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
  topK: number
): Promise<PaperChunk[]> {
  const terms = query.split(/\s+/).filter((t) => t.length > 1)
  if (terms.length === 0) return []

  const { data } = await supabase
    .from('medical_papers')
    .select('id, pmid, title, abstract, citation_count, tldr, chunk_text')
    .order('citation_count', { ascending: false })
    .limit(topK * 3)

  if (!data?.length) return []

  const scored = data
    .map((r) => {
      const text = `${r.title} ${r.chunk_text}`.toLowerCase()
      const score = terms.reduce((s, t) => s + (text.includes(t.toLowerCase()) ? 1 : 0), 0)
      return { ...r, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map((r) => ({
    id: r.id,
    pmid: r.pmid,
    title: r.title ?? '',
    abstract: r.abstract,
    citation_count: r.citation_count ?? 0,
    tldr: r.tldr,
    chunk_text: r.chunk_text ?? '',
  }))
}

export function formatPaperContext(chunks: PaperChunk[]): string {
  if (chunks.length === 0) return ''

  const seen = new Set<string>()
  const items: string[] = []

  for (const c of chunks) {
    const key = c.pmid || c.title
    if (seen.has(key)) continue
    seen.add(key)

    const pmidLabel = c.pmid?.startsWith('hash-') ? '' : ` (PMID: ${c.pmid})`
    items.push(`[${c.title}${pmidLabel}]\n${c.chunk_text}`)
    if (c.tldr) items.push(`  → TLDR: ${c.tldr}`)
  }

  return items.join('\n\n')
}

export function formatDisclaimer(chunks: PaperChunk[]): string {
  const unique = chunks.filter((c) => c.pmid && !c.pmid.startsWith('hash-'))
  if (unique.length === 0) return ''

  const refs = unique
    .map((c) => `[${c.title}](https://pubmed.ncbi.nlm.nih.gov/${c.pmid}/) (PMID: ${c.pmid})`)
    .join(', ')
  return `\n\n본 정보는 ${refs} 등 학술 자료를 근거로 작성되었으며, 정확한 진단은 전문의와 상의하세요.`
}
