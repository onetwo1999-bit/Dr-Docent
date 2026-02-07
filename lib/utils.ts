import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 사용자 로컬 시간 기준 "오늘"의 UTC 시작/끝 시각을 ISO 문자열로 반환.
 * UTC가 아닌 로컬 날짜로 오늘 기록을 조회할 때 사용.
 */
export function getLocalTodayUtcBounds(): { start: string; end: string } {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  const day = d.getDate()
  const startOfDay = new Date(y, m, day, 0, 0, 0, 0)
  const endOfDay = new Date(y, m, day, 23, 59, 59, 999)
  return {
    start: startOfDay.toISOString().slice(0, 19),
    end: endOfDay.toISOString().slice(0, 19),
  }
}
