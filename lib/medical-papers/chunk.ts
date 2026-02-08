/**
 * 텍스트 청킹 (OpenAI 임베딩용)
 */

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 80

export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): string[] {
  if (!text?.trim()) return []
  const t = text.trim()
  const chunks: string[] = []
  let start = 0
  while (start < t.length) {
    let end = start + chunkSize
    let chunk = t.slice(start, end)
    if (end < t.length) {
      const lastPeriod = chunk.lastIndexOf('.')
      const lastNewline = chunk.lastIndexOf('\n')
      const cut = Math.max(lastPeriod, lastNewline)
      if (cut > chunkSize / 2) {
        chunk = chunk.slice(0, cut + 1)
        end = start + cut + 1
      }
    }
    const trimmed = chunk.trim()
    if (trimmed) chunks.push(trimmed)
    start = end - overlap
  }
  return chunks
}
