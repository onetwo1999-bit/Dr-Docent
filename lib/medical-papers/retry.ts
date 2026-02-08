/**
 * 지수 백오프(Exponential Backoff) 재시도 유틸
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000 } = options
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === maxRetries) throw e
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}
