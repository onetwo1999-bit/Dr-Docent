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

export async function fetchAbstracts(pmids: string[]): Promise<
  Array<{ pmid: string; title: string; abstract: string }>
> {
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
  const out: Array<{ pmid: string; title: string; abstract: string }> = []

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

    let abstract = ''
    const absBlock = article.abstract?.abstracttext
    if (absBlock) {
      abstract = Array.isArray(absBlock)
        ? absBlock.map((x: { _?: string } | string) => (typeof x === 'string' ? x : x._ ?? '')).join(' ')
        : String(absBlock)
    }

    if (title || abstract) {
      out.push({ pmid, title: title || 'Untitled', abstract })
    }
  }

  return out
}
