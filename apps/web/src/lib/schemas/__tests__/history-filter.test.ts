import { describe, it, expect } from 'vitest'
import {
  HistoryFilterSchema,
  JobSummarySchema,
  JobDetailSchema,
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

  it('custom: from 은 종료일 시작, to 는 종료일 다음날 0시 (KST) — 종료일 전체 포함 (H2)', () => {
    const filter = HistoryFilterSchema.parse({
      period: 'custom',
      from: '2026-05-01',
      to: '2026-05-15',
    })
    const range = periodToRange(filter)
    // from = 2026-05-01 00:00 KST = 2026-04-30T15:00:00Z
    expect(range.from).toBe('2026-04-30T15:00:00.000Z')
    // to = 2026-05-16 00:00 KST = 2026-05-15T15:00:00Z (created_at < p_to 배타 상한이므로 15일 전체 포함)
    expect(range.to).toBe('2026-05-15T15:00:00.000Z')
  })
})

// ─────────────────────────────────────────────
// H1: list_registration_jobs / get_registration_job RPC 는 Postgres timestamptz 를
//     +00:00 offset 형식으로 반환한다. 스키마가 offset 을 허용해야 실DB 파싱이 통과.
// ─────────────────────────────────────────────
describe('JobSummarySchema / JobDetailSchema — Postgres offset 타임스탬프 허용 (H1)', () => {
  const SUMMARY_ROW = {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'succeeded' as const,
    createdAt: '2026-05-19T10:00:00+00:00',
    startedAt: '2026-05-19T10:00:05+00:00',
    completedAt: '2026-05-19T10:01:00+00:00',
    retryCount: 0,
    errorSummary: null,
    parentJobId: null,
    productId: '22222222-2222-4222-8222-222222222222',
    productName: '여름 원피스',
    productThumbnailId: null,
    marketSummary: [{ marketId: 'naver' as const, marketStatus: 'success' as const, excluded: false }],
  }

  it('JobSummarySchema: createdAt 가 +00:00 offset 형식이어도 parse 성공', () => {
    expect(JobSummarySchema.safeParse(SUMMARY_ROW).success).toBe(true)
  })

  it('JobDetailSchema: 모든 타임스탬프가 offset 형식이어도 parse 성공', () => {
    const detail = {
      job: {
        id: '11111111-1111-4111-8111-111111111111',
        sellerId: '33333333-3333-4333-8333-333333333333',
        productId: '22222222-2222-4222-8222-222222222222',
        status: 'partial' as const,
        createdAt: '2026-05-19T10:00:00+00:00',
        startedAt: '2026-05-19T10:00:05+00:00',
        completedAt: null,
        retryCount: 1,
        errorSummary: null,
        cancelledAt: null,
        parentJobId: null,
        correlationId: '44444444-4444-4444-8444-444444444444',
      },
      cancelledByMaskedId: null,
      product: { id: '22222222-2222-4222-8222-222222222222', name: '여름 원피스', thumbnailImageId: null },
      parent: null,
      children: [],
      marketResults: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          marketId: 'coupang' as const,
          marketStatus: 'failed' as const,
          externalProductId: null,
          productUrl: null,
          errorCode: 'token_expired',
          errorMessage: '토큰 만료',
          attemptCount: 1,
          lastAttemptedAt: '2026-05-19T10:00:30+00:00',
          excluded: false,
          updatedAt: '2026-05-19T10:00:30+00:00',
        },
      ],
    }
    expect(JobDetailSchema.safeParse(detail).success).toBe(true)
  })
})
