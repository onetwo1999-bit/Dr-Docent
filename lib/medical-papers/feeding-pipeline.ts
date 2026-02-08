/**
 * 유저 질문 기반 실시간 논문 자동 피딩 파이프라인
 */

import OpenAI from 'openai'
import { searchPubMed, fetchAbstracts } from './pubmed'
import { fetchPapersBatch } from './semantic-scholar'
import { chunkText } from './chunk'
import { createAdminClient } from '@/utils/supabase/admin'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const MIN_CITATION_COUNT = 3
const MAX_PAPERS_TO_STORE = 10

export type FeedingResult = {
  query: string
  pmidsFound: number
  papersStored: number
  chunksStored: number
  errors?: string[]
}

export async function runFeedingPipeline(
  query: string,
  options?: { minCitations?: number; maxPapers?: number }
): Promise<FeedingResult> {
  const minCitations = options?.minCitations ?? MIN_CITATION_COUNT
  const maxPapers = options?.maxPapers ?? MAX_PAPERS_TO_STORE

  const result: FeedingResult = {
    query,
    pmidsFound: 0,
    papersStored: 0,
    chunksStored: 0,
    errors: [],
  }

  // 1. PubMed 검색
  let pmids: string[] = []
  try {
    pmids = await searchPubMed(query, 30)
    result.pmidsFound = pmids.length
  } catch (e) {
    result.errors?.push(`PubMed 검색 실패: ${(e as Error).message}`)
    return result
  }

  if (pmids.length === 0) return result

  // 2. PubMed에서 초록 수집
  let pubmedPapers: Array<{ pmid: string; title: string; abstract: string }> = []
  try {
    pubmedPapers = await fetchAbstracts(pmids)
  } catch (e) {
    result.errors?.push(`PubMed 초록 수집 실패: ${(e as Error).message}`)
    return result
  }

  // 3. Semantic Scholar에서 인용·TLDR 수집
  const s2Map = new Map<string, { citationCount?: number; tldr?: string }>()
  try {
    const s2Batch = await fetchPapersBatch(pmids)
    s2Batch.forEach((p, pmid) => {
      s2Map.set(pmid, {
        citationCount: p.citationCount ?? 0,
        tldr: p.tldr?.text ?? undefined,
      })
    })
  } catch (e) {
    result.errors?.push(`Semantic Scholar 수집 실패: ${(e as Error).message}`)
  }

  // 4. 인용 수 필터, 상위 N개만
  const enriched = pubmedPapers
    .map((p) => ({
      ...p,
      citation_count: s2Map.get(p.pmid)?.citationCount ?? 0,
      tldr: s2Map.get(p.pmid)?.tldr ?? '',
    }))
    .filter((p) => p.citation_count >= minCitations)
    .sort((a, b) => b.citation_count - a.citation_count)
    .slice(0, maxPapers)

  if (enriched.length === 0) return result

  // 5. 임베딩 생성 및 DB 저장
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    result.errors?.push('OPENAI_API_KEY 없음')
    return result
  }

  const openai = new OpenAI({ apiKey: openaiKey })
  const supabase = createAdminClient()

  for (const paper of enriched) {
    const chunks = chunkText(paper.abstract || paper.title)
    if (chunks.length === 0) continue

    const rows: Array<{
      pmid: string
      title: string
      abstract: string | null
      citation_count: number
      tldr: string | null
      chunk_index: number
      chunk_text: string
      embedding: number[]
    }> = []

    for (let i = 0; i < chunks.length; i++) {
      try {
        const emb = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: chunks[i].slice(0, 8000),
        })
        const vector = emb.data[0]?.embedding
        if (!vector) continue

        rows.push({
          pmid: paper.pmid,
          title: paper.title,
          abstract: paper.abstract || null,
          citation_count: paper.citation_count,
          tldr: paper.tldr || null,
          chunk_index: i,
          chunk_text: chunks[i],
          embedding: vector,
        })
      } catch (e) {
        result.errors?.push(`임베딩 실패 (pmid=${paper.pmid}): ${(e as Error).message}`)
      }
    }

    if (rows.length === 0) continue

    // 기존 청크 삭제 후 삽입
    try {
      await supabase.from('medical_papers').delete().eq('pmid', paper.pmid)
      await supabase.from('medical_papers').insert(rows)
      result.papersStored += 1
      result.chunksStored += rows.length
    } catch (e) {
      result.errors?.push(`DB 저장 실패 (pmid=${paper.pmid}): ${(e as Error).message}`)
    }
  }

  return result
}
