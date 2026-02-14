/**
 * PubMed API 유틸리티 (NCBI E-utilities)
 * - PUBMED_API_KEY 사용 시 초당 10회 제한 준수
 * - esearch → efetch 파이프라인, 재시도 로직 포함
 * - 동일 쿼리 캐싱으로 반복 요청 감소
 */

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
/** API 키 있을 때 10회/초 제한 → 요청 간 최소 100ms */
const RATE_LIMIT_MS = 110
const RETRY_MAX = 3
const RETRY_BASE_DELAY_MS = 1000
const CACHE_TTL_MS = 5 * 60 * 1000 // 5분

export type PubMedPaperResult = {
  pmid: string
  title: string
  abstract: string
  doi?: string
  url: string
}

let lastRequestTime = 0

function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < RATE_LIMIT_MS) {
    return new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed))
  }
  lastRequestTime = Date.now()
  return Promise.resolve()
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (attempt === RETRY_MAX) throw e
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function getApiKey(): string {
  return process.env.PUBMED_API_KEY ?? ''
}

/**
 * esearch: 검색어로 관련도 높은 최신 논문 PMID 3~5개 추출
 */
export async function esearch(
  query: string,
  retmax: number = 5
): Promise<string[]> {
  const apiKey = getApiKey()
  await rateLimit()
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query.trim(),
    retmax: String(Math.min(10, Math.max(3, retmax))),
    retmode: 'json',
    sort: 'relevance',
  })
  if (apiKey) params.set('api_key', apiKey)

  const res = await withRetry(async () => {
    const r = await fetch(`${BASE}/esearch.fcgi?${params}`)
    if (!r.ok) throw new Error(`PubMed esearch failed: ${r.status}`)
    return r.json()
  })

  const idlist: string[] = res?.esearchresult?.idlist ?? []
  return Array.isArray(idlist) ? idlist : []
}

/**
 * esummary: PMID 목록으로 제목·초록 조회 (JSON 응답만 사용 — efetch는 XML/비정형 반환 시 JSON 파싱 오류 발생)
 */
export async function efetch(pmids: string[]): Promise<PubMedPaperResult[]> {
  if (pmids.length === 0) return []

  const apiKey = getApiKey()
  await rateLimit()
  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'json',
  })
  if (apiKey) params.set('api_key', apiKey)

  const res = await withRetry(async () => {
    const r = await fetch(`${BASE}/esummary.fcgi?${params}`)
    if (!r.ok) throw new Error(`PubMed esummary failed: ${r.status}`)
    const text = await r.text()
    try {
      return JSON.parse(text) as { result?: Record<string, { title?: string; abstract?: string; source?: string }> }
    } catch (parseErr) {
      throw new Error(`PubMed esummary 응답이 JSON이 아님: ${text.slice(0, 80)}...`)
    }
  })

  const result = res?.result ?? {}
  const out: PubMedPaperResult[] = []

  for (const pmid of pmids) {
    const item = result[pmid]
    if (!item || typeof item !== 'object') continue

    const title = typeof item.title === 'string' ? item.title : 'Untitled'
    const abstract = typeof item.abstract === 'string' ? item.abstract : ''

    if (title || abstract) {
      out.push({
        pmid,
        title: title || 'Untitled',
        abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      })
    }
  }

  return out
}

/**
 * 검색 + 상세 조회 한 번에 (RAG용 3~5건)
 */
export async function searchAndFetch(
  query: string,
  retmax: number = 5
): Promise<PubMedPaperResult[]> {
  const ids = await esearch(query, retmax)
  if (ids.length === 0) return []
  return efetch(ids)
}

/** 캐시 엔트리 */
const searchCache = new Map<
  string,
  { papers: PubMedPaperResult[]; ts: number }
>()

function cacheKey(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * 캐시 적용: 동일 쿼리는 TTL 동안 재사용
 */
export async function searchAndFetchCached(
  query: string,
  retmax: number = 5
): Promise<PubMedPaperResult[]> {
  const key = cacheKey(query)
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.papers
  }
  const papers = await searchAndFetch(query, retmax)
  searchCache.set(key, { papers, ts: Date.now() })
  return papers
}
