import { describe, it, expect } from 'vitest'
import {
  DashboardSummarySchema,
  MarketHealthSchema,
  MarketOrderItemSchema,
  RecentJobSchema,
} from '@/lib/schemas/dashboard-summary'

/**
 * dashboard zod 스키마 단위 테스트.
 * 마스터: docs/architecture/v1/features/dashboard.md §3.
 * 정책: pass 1 + fail ≥1 (testing.md §6.1).
 */

const VALID_SUMMARY = {
  seller_id: '11111111-1111-1111-1111-111111111111',
  jobs_today_count: 3,
  jobs_in_progress_count: 1,
  jobs_24h_count: 8,
  jobs_24h_succeeded: 6,
  jobs_24h_partial: 1,
  jobs_24h_failed: 1,
  jobs_7d_count: 42,
  jobs_7d_succeeded: 38,
  jobs_7d_partial: 2,
  jobs_7d_failed: 2,
  jobs_30d_count: 120,
  avg_duration_sec_7d: 18.5,
  last_job_at: '2026-05-19T10:00:00+09:00',
}

describe('DashboardSummarySchema', () => {
  it('정상 응답 parse 통과', () => {
    expect(DashboardSummarySchema.parse(VALID_SUMMARY)).toMatchObject({
      jobs_today_count: 3,
      avg_duration_sec_7d: 18.5,
    })
  })

  it('avg_duration_sec_7d 가 string("18.5") 이어도 coerce 로 통과 (numeric 컬럼 호환)', () => {
    const res = DashboardSummarySchema.safeParse({ ...VALID_SUMMARY, avg_duration_sec_7d: '18.5' })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.avg_duration_sec_7d).toBe(18.5)
  })

  it('jobs_today_count 가 음수면 실패', () => {
    const res = DashboardSummarySchema.safeParse({ ...VALID_SUMMARY, jobs_today_count: -1 })
    expect(res.success).toBe(false)
  })

  it('seller_id 가 uuid 아니면 실패', () => {
    const res = DashboardSummarySchema.safeParse({ ...VALID_SUMMARY, seller_id: 'not-uuid' })
    expect(res.success).toBe(false)
  })
})

describe('MarketHealthSchema', () => {
  it('정상 카운트 parse 통과', () => {
    expect(
      MarketHealthSchema.parse({
        active: 3,
        expired: 1,
        revoked: 0,
        error: 0,
        total: 4,
      }),
    ).toMatchObject({ active: 3, total: 4 })
  })

  it('음수면 실패', () => {
    const res = MarketHealthSchema.safeParse({
      active: -1,
      expired: 0,
      revoked: 0,
      error: 0,
      total: 0,
    })
    expect(res.success).toBe(false)
  })
})

describe('MarketOrderItemSchema', () => {
  const VALID_ITEM = {
    marketId: 'naver',
    connected: true,
    newOrdersCount: 5,
    todayTotalCount: 12,
    lastSyncedAt: '2026-05-21T09:00:00+09:00',
    syncStatus: 'idle',
    syncError: null,
  }

  it('연동된 마켓 row parse 통과', () => {
    expect(MarketOrderItemSchema.parse(VALID_ITEM)).toMatchObject({
      marketId: 'naver',
      connected: true,
    })
  })

  it('미연동 마켓 (connected:false) row parse 통과', () => {
    const res = MarketOrderItemSchema.safeParse({ ...VALID_ITEM, connected: false })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.connected).toBe(false)
  })

  it('connected 누락 시 실패', () => {
    const { connected, ...withoutConnected } = VALID_ITEM
    void connected
    const res = MarketOrderItemSchema.safeParse(withoutConnected)
    expect(res.success).toBe(false)
  })
})

describe('RecentJobSchema', () => {
  const RECENT_JOB = {
    job_id: '22222222-2222-2222-2222-222222222222',
    seller_id: '11111111-1111-1111-1111-111111111111',
    product_id: '33333333-3333-3333-3333-333333333333',
    job_status: 'partial',
    created_at: '2026-05-19T10:00:00+09:00',
    started_at: '2026-05-19T10:00:05+09:00',
    completed_at: '2026-05-19T10:00:45+09:00',
    retry_count: 0,
    error_summary: null,
    parent_job_id: null,
    markets: [
      {
        market_id: 'naver',
        market_status: 'success',
        attempt_count: 1,
        external_product_id: 'EXT-001',
        product_url: 'https://example.com/p/1',
        error_code: null,
        excluded: false,
      },
    ],
    success_count: 1,
    failed_count: 0,
    market_total_count: 1,
  }

  it('정상 row parse 통과', () => {
    expect(RecentJobSchema.parse(RECENT_JOB)).toMatchObject({ job_status: 'partial' })
  })

  it('잘못된 job_status (예: in_progress) 는 실패', () => {
    const res = RecentJobSchema.safeParse({ ...RECENT_JOB, job_status: 'in_progress' })
    expect(res.success).toBe(false)
  })
})
