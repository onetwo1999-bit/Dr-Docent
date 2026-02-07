'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = CURRENT_YEAR - 120
const YEARS = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i).reverse()
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS_IN_MONTH = (y: number, m: number) => new Date(y, m, 0).getDate()

function getDays(year: number, month: number): number[] {
  const n = DAYS_IN_MONTH(year, month)
  return Array.from({ length: n }, (_, i) => i + 1)
}

const ITEM_HEIGHT = 44
const VISIBLE_HEIGHT = 176
const PADDING_Y = (VISIBLE_HEIGHT - ITEM_HEIGHT) / 2 // 66

interface BirthDateWheelPickerProps {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  maxDate?: string // YYYY-MM-DD, default today
  className?: string
}

export default function BirthDateWheelPicker({
  value,
  onChange,
  maxDate = new Date().toISOString().split('T')[0],
  className = '',
}: BirthDateWheelPickerProps) {
  const [maxY, maxM, maxD] = maxDate.split('-').map(Number)

  const parseValue = useCallback(() => {
    if (value && value.length >= 10) {
      const y = parseInt(value.slice(0, 4), 10)
      const m = parseInt(value.slice(5, 7), 10)
      const d = parseInt(value.slice(8, 10), 10)
      return { y: !isNaN(y) ? y : CURRENT_YEAR - 30, m: !isNaN(m) && m >= 1 && m <= 12 ? m : 1, d: !isNaN(d) ? d : 1 }
    }
    return { y: CURRENT_YEAR - 30, m: 1, d: 1 }
  }, [value])

  const [year, setYear] = useState(parseValue().y)
  const [month, setMonth] = useState(parseValue().m)
  const [day, setDay] = useState(parseValue().d)

  const yearRef = useRef<HTMLDivElement>(null)
  const monthRef = useRef<HTMLDivElement>(null)
  const dayRef = useRef<HTMLDivElement>(null)

  const yearList = useMemo(() => YEARS.filter((y) => y <= maxY), [maxY])
  const monthList = useMemo(() => (year === maxY ? MONTHS.filter((m) => m <= maxM) : MONTHS), [year, maxY, maxM])
  const dayList = useMemo(() => getDays(year, month), [year, month])
  const dayListBounded = useMemo(
    () => (year === maxY && month === maxM ? dayList.filter((d) => d <= maxD) : dayList),
    [year, month, maxY, maxM, maxD, dayList]
  )

  const emit = useCallback(
    (y: number, m: number, d: number) => {
      const maxDays = DAYS_IN_MONTH(y, m)
      const safeDay = Math.min(Math.max(1, d), maxDays)
      const [sy, sm, sd] = [y, m, safeDay].map((n) => (n < 10 ? `0${n}` : `${n}`))
      onChange(`${y}-${sm}-${sd}`)
    },
    [onChange]
  )

  const scrollToOption = useCallback((ref: React.RefObject<HTMLDivElement | null>, index: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const { y, m, d } = parseValue()
    setYear(y)
    setMonth(m)
    setDay(d)
  }, [value, parseValue])

  useEffect(() => {
    const safeDay = Math.min(day, dayList[dayList.length - 1] ?? 31)
    if (day !== safeDay) setDay(safeDay)
  }, [year, month, dayList])

  useEffect(() => {
    const idx = yearList.indexOf(year)
    if (idx >= 0) scrollToOption(yearRef, idx)
  }, [year, yearList, scrollToOption])
  useEffect(() => {
    const idx = monthList.indexOf(month)
    if (idx >= 0) scrollToOption(monthRef, idx)
  }, [month, monthList, scrollToOption])
  useEffect(() => {
    const d = Math.min(day, dayListBounded[dayListBounded.length - 1] ?? 31)
    const idx = dayListBounded.indexOf(d)
    if (idx >= 0) scrollToOption(dayRef, idx)
  }, [day, dayListBounded, scrollToOption])

  const handleYearScroll = useCallback(() => {
    const el = yearRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT)
    const v = yearList[Math.max(0, Math.min(idx, yearList.length - 1))]
    setYear(v)
    emit(v, month, day)
  }, [yearList, month, day, emit])

  const handleMonthScroll = useCallback(() => {
    const el = monthRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT)
    const v = monthList[Math.max(0, Math.min(idx, monthList.length - 1))]
    setMonth(v)
    emit(year, v, day)
  }, [monthList, year, day, emit])

  const handleDayScroll = useCallback(() => {
    const el = dayRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / ITEM_HEIGHT)
    const v = dayListBounded[Math.max(0, Math.min(idx, dayListBounded.length - 1))]
    setDay(v)
    emit(year, month, v)
  }, [dayListBounded, year, month, emit])

  useEffect(() => {
    if (!value || value.length < 10) emit(year, month, day)
  }, [])

  const wheelStyle = {
    paddingTop: PADDING_Y,
    paddingBottom: PADDING_Y,
    scrollSnapType: 'y mandatory' as const,
  }
  const itemStyle = { minHeight: ITEM_HEIGHT, scrollSnapAlign: 'center' as const }
  const maskStyle = {
    maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)',
  }

  return (
    <div className={`flex items-stretch justify-center gap-2 ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: '.birth-date-wheel::-webkit-scrollbar { display: none }' }} />
      {/* 년 */}
      <div className="relative flex-1 min-w-0 max-w-[100px]">
        <div
          className="h-[176px] overflow-hidden rounded-xl bg-gray-50 border border-gray-200"
          style={maskStyle}
        >
          <div
            ref={yearRef}
            className="birth-date-wheel h-full overflow-y-auto overflow-x-hidden scroll-smooth"
            style={{ ...wheelStyle, scrollbarWidth: 'none' }}
            onScroll={handleYearScroll}
          >
            <div>
              {yearList.map((y) => (
                <div key={y} className="h-11 flex items-center justify-center text-gray-800 font-medium text-sm" style={itemStyle}>
                  {y}년
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 border-y-2 border-[#2DD4BF]/40 rounded bg-white/50" aria-hidden />
      </div>

      {/* 월 */}
      <div className="relative flex-1 min-w-0 max-w-[72px]">
        <div
          className="h-[176px] overflow-hidden rounded-xl bg-gray-50 border border-gray-200"
          style={maskStyle}
        >
          <div
            ref={monthRef}
            className="birth-date-wheel h-full overflow-y-auto overflow-x-hidden scroll-smooth"
            style={{ ...wheelStyle, scrollbarWidth: 'none' }}
            onScroll={handleMonthScroll}
          >
            {monthList.map((m) => (
              <div key={m} className="h-11 flex items-center justify-center text-gray-800 font-medium text-sm" style={itemStyle}>
                {m}월
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 border-y-2 border-[#2DD4BF]/40 rounded bg-white/50" aria-hidden />
      </div>

      {/* 일 */}
      <div className="relative flex-1 min-w-0 max-w-[72px]">
        <div
          className="h-[176px] overflow-hidden rounded-xl bg-gray-50 border border-gray-200"
          style={maskStyle}
        >
          <div
            ref={dayRef}
            className="birth-date-wheel h-full overflow-y-auto overflow-x-hidden scroll-smooth"
            style={{ ...wheelStyle, scrollbarWidth: 'none' }}
            onScroll={handleDayScroll}
          >
            {dayListBounded.map((d) => (
              <div key={d} className="h-11 flex items-center justify-center text-gray-800 font-medium text-sm" style={itemStyle}>
                {d}일
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 border-y-2 border-[#2DD4BF]/40 rounded bg-white/50" aria-hidden />
      </div>
    </div>
  )
}
