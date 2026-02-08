/**
 * PubMed E-utilities API
 * https://eutils.ncbi.nlm.nih.gov/
 */

import { withRetry } from './retry'

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export async function searchPubMed(
  query: string,
  maxResults = 20
): Promise<string[]> {
  const apiKey = process.env.PUBMED_API_KEY
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: String(maxResults),
    retmode: 'json',
  })
  if (apiKey) params.set('api_key', apiKey)

  const res = await withRetry(async () => {
    const r = await fetch(`${BASE}/esearch.fcgi?${params}`)
    if (!r.ok) throw new Error(`PubMed search failed: ${r.status}`)
    return r.json()
  })

  const ids = res?.esearchresult?.idlist ?? []
  return Array.isArray(ids) ? ids : []
}

export type PubMedPaper = {
  pmid: string
  title: string
  authors: string
  abstract: string
}

export async function fetchAbstracts(pmids: string[]): Promise<PubMedPaper[]> {
  if (pmids.length === 0) return []

  const apiKey = process.env.PUBMED_API_KEY
  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    rettype: 'abstract',
    retmode: 'json',
  })
  if (apiKey) params.set('api_key', apiKey)

  const res = await withRetry(async () => {
    const r = await fetch(`${BASE}/efetch.fcgi?${params}`)
    if (!r.ok) throw new Error(`PubMed fetch failed: ${r.status}`)
    return r.json()
  })

  const result = res?.result ?? {}
  const out: PubMedPaper[] = []

  for (const pmid of pmids) {
    const doc = result[pmid]
    if (!doc) continue
    const article = doc.pubmedarticle?.[0]?.article ?? doc.article
    if (!article) continue

    const title = article.articletitle
      ? (typeof article.articletitle === 'string'
          ? article.articletitle
          : article.articletitle?.[0] ?? '')
      : ''

    let authors = ''
    const authorList = article.authors?.author
    if (Array.isArray(authorList) && authorList.length > 0) {
      authors = authorList
        .map((a: { LastName?: string; ForeName?: string; Initials?: string; collectivename?: string }) => {
          if (a.collectivename) return a.collectivename
          const last = a.LastName || ''
          const init = a.Initials || a.ForeName || ''
          return init ? `${last} ${init}`.trim() : last
        })
        .filter(Boolean)
        .join(', ')
    }

    let abstract = ''
    const absBlock = article.abstract?.abstracttext
    if (absBlock) {
      abstract = Array.isArray(absBlock)
        ? absBlock.map((x: { _?: string } | string) => (typeof x === 'string' ? x : x._ ?? '')).join(' ')
        : String(absBlock)
    }

    if (title || abstract) {
      out.push({
        pmid,
        title: title || 'Untitled',
        authors,
        abstract,
      })
    }
  }

  return out
}

/** 건강 관련 질문 시 PubMed 직접 검색 → 제목/저자/초록/PMID JSON 반환 */
export async function searchAndFetchPapers(
  query: string,
  maxResults = 10
): Promise<PubMedPaper[]> {
  const pmids = await searchPubMed(query, maxResults)
  if (pmids.length === 0) return []
  return fetchAbstracts(pmids)
}
