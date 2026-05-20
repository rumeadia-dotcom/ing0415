import { describe, it, expect } from 'vitest'
import {
  HistoryFilterSchema,
  historyFilterFromSearchParams,
  historyFilterToSearchParams,
  periodToRange,
  type HistoryFilter,
} from '@/lib/schemas/history-filter'

/**
 * history-filter zod 스키마 + URL round-trip 단위 테스트.
 * 마스터: docs/architecture/v1/features/history.md §3 / §5.
 */

describe('HistoryFilterSchema', () => {
  it('빈 입력 → period:30d, pageSize:20 디폴트 적용', () => {
    const res = HistoryFilterSchema.parse({})
    expect(res.period).toBe('30d')
    expect(res.pageSize).toBe(20)
  })

  it('custom period 인데 from/to 누락 시 실패', () => {
    const res = HistoryFilterSchema.safeParse({ period: 'custom' })
    expect(res.success).toBe(false)
  })

  it('custom period 인데 from > to 면 실패', () => {
    const res = HistoryFilterSchema.safeParse({
      period: 'custom',
      from: '2026-05-19',
      to: '2026-05-01',
    })
    expect(res.success).toBe(false)
  })

  it('pageSize 가 20 / 50 외 값이면 실패', () => {
    const res = HistoryFilterSchema.safeParse({ pageSize: 30 })
    expect(res.success).toBe(false)
  })
})

describe('historyFilterFromSearchParams / historyFilterToSearchParams (round-trip)', () => {
  it('디폴트 필터 → URL 빈 문자열', () => {
    const def: HistoryFilter = HistoryFilterSchema.parse({})
    const params = historyFilterToSearchParams(def)
    expect(params.toString()).toBe('')
  })

  it('markets / statuses / q 가 있으면 URL ↔ filter round-trip', () => {
    const filter: HistoryFilter = HistoryFilterSchema.parse({
      period: '7d',
      markets: ['naver', 'coupang'],
      statuses: ['partial', 'failed'],
      q: '여름원피스',
      pageSize: 50,
    })
    const params = historyFilterToSearchParams(filter)
    const back = historyFilterFromSearchParams(params)
    expect(back.period).toBe('7d')
    expect(back.markets).toEqual(['naver', 'coupang'])
    expect(back.statuses).toEqual(['partial', 'failed'])
    expect(back.q).toBe('여름원피스')
    expect(back.pageSize).toBe(50)
  })

  it('잘못된 market 값은 무시 (graceful fallback)', () => {
    const params = new URLSearchParams('market=naver,bad-market')
    const back = historyFilterFromSearchParams(params)
    expect(back.markets).toEqual(['naver'])
  })

  it('URL 전체가 깨져도 디폴트로 fallback', () => {
    const params = new URLSearchParams('period=invalid&pageSize=999')
    const back = historyFilterFromSearchParams(params)
    expect(back.period).toBe('30d')
    expect(back.pageSize).toBe(20)
  })
})

describe('periodToRange', () => {
  it('today: from < to 이고 둘 다 정의됨', () => {
    const filter = HistoryFilterSchema.parse({ period: 'today' })
    const range = periodToRange(filter)
    expect(range.from).toBeDefined()
    expect(range.to).toBeDefined()
    expect(new Date(range.from ?? '').getTime()).toBeLessThan(
      new Date(range.to ?? '').getTime(),
    )
  })

  it('7d: from 이 to 보다 약 7일 전', () => {
    const filter = HistoryFilterSchema.parse({ period: '7d' })
    const range = periodToRange(filter)
    const diff = new Date(range.to ?? '').getTime() - new Date(range.from ?? '').getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    expect(Math.abs(diff - sevenDays)).toBeLessThan(60_000) // 1분 오차 허용
  })

  it('custom: from/to 그대로 반환 (둘 다 있으면)', () => {
    const filter = HistoryFilterSchema.parse({
      period: 'custom',
      from: '2026-05-01',
      to: '2026-05-15',
    })
    const range = periodToRange(filter)
    expect(range.from).toBe('2026-05-01')
    expect(range.to).toBe('2026-05-15')
  })
})
