/**
 * PubMed 검색어 최적화: 한국어 증상/질문 → 영어 의학 키워드 변환
 * 답변 생성 전처리에서 호출 (Server-side only)
 */

const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

const SYSTEM = `You are a medical search query translator. Given a user message in Korean about symptoms, exercise, or health, output ONLY a short English phrase optimized for PubMed search. Use medical terminology (e.g. "lumbar disc herniation", "exercise therapy", "knee osteoarthritis"). No explanation, no quotes, just the search terms. One line only.`

/**
 * 한국어 질문을 PubMed 검색에 적합한 영어 의학 키워드로 변환
 * - 입력이 이미 영어 위주면 그대로 반환
 * - 실패 시 원문 반환 (한글 제거 후 공백 정리)
 */
export async function translateToPubMedQuery(koreanQuery: string): Promise<string> {
  const q = (koreanQuery || '').trim()
  if (!q) return ''

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return fallbackQuery(q)
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: q },
        ],
        max_tokens: 80,
        temperature: 0.2,
      }),
    })
    if (!res.ok) return fallbackQuery(q)
    const data = await res.json().catch(() => null)
    const text = data?.choices?.[0]?.message?.content?.trim()
    if (text && text.length > 0) return text
  } catch {
    // ignore
  }
  return fallbackQuery(q)
}

/** 번역 실패 시: 한글 제거 후 영문/숫자만 남기거나 원문 일부 반환 */
function fallbackQuery(q: string): string {
  const ascii = q.replace(/[^\x00-\x7F\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (ascii.length >= 2) return ascii
  return q
}
