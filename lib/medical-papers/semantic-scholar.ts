/**
 * Semantic Scholar API - 인용 수, TLDR 수집
 */

import { withRetry } from './retry'

const BASE = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'title,abstract,citationCount,tldr'

export type S2Paper = {
  paperId?: string
  title?: string
  abstract?: string | null
  citationCount?: number
  tldr?: { text?: string } | null
}

export async function fetchPaperByPmid(pmid: string): Promise<S2Paper | null> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) headers['x-api-key'] = apiKey

  const res = await withRetry(async () => {
    const r = await fetch(
      `${BASE}/paper/PMID:${pmid}?fields=${FIELDS}`,
      { headers }
    )
    if (r.status === 404) return null
    if (!r.ok) throw new Error(`S2 fetch failed: ${r.status}`)
    return r.json()
  })

  return res
}

export async function fetchPapersBatch(
  pmids: string[]
): Promise<Map<string, S2Paper>> {
  if (pmids.length === 0) return new Map()

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (apiKey) headers['x-api-key'] = apiKey

  const ids = pmids.map((p) => `PMID:${p}`)
  const batchSize = 100
  const map = new Map<string, S2Paper>()

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize)
    const res = await withRetry(async () => {
      const r = await fetch(`${BASE}/paper/batch?fields=${FIELDS}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: chunk }),
      })
      if (!r.ok) throw new Error(`S2 batch failed: ${r.status}`)
      return r.json()
    })

    const list = Array.isArray(res) ? res : []
    chunk.forEach((id, idx) => {
      const paper = list[idx]
      const pmid = id.replace('PMID:', '')
      if (paper && !paper.error) {
        map.set(pmid, paper)
      }
    })
  }

  return map
}
