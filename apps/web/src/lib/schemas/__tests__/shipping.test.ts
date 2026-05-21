import { describe, it, expect } from 'vitest'
import {
  ShippingJobStatusEnum,
  ShippingMarketStatusEnum,
  ShippingJobSchema,
  ShippingJobResultSchema,
  ShippingDispatchPreviewSchema,
  ShippingDispatchStartInputSchema,
  ShippingDispatchRetryInputSchema,
  SHIPPING_JOB_STATUSES,
  SHIPPING_MARKET_STATUSES,
} from '@/lib/schemas/shipping'

/**
 * v2 송장 일괄 제출 zod 스키마 단위 테스트.
 *
 * 마스터:
 *  - docs/spec/PRD-v2-shipping.md §2.4 / §4
 *  - testing.md §6.1 (pass 1 + fail ≥1)
 */

describe('ShippingJobStatusEnum (5상태)', () => {
  it('5개 모두 통과', () => {
    for (const s of SHIPPING_JOB_STATUSES) {
      expect(ShippingJobStatusEnum.parse(s)).toBe(s)
    }
  })

  it('registration jobs 의 retrying 은 본 ENUM 에서 거부', () => {
    expect(ShippingJobStatusEnum.safeParse('retrying').success).toBe(false)
  })
})

describe('ShippingMarketStatusEnum (2상태)', () => {
  it('success / failed 통과', () => {
    for (const s of SHIPPING_MARKET_STATUSES) {
      expect(ShippingMarketStatusEnum.parse(s)).toBe(s)
    }
  })

  it('pending / in_flight 는 거부 (registration_result 와 분리)', () => {
    expect(ShippingMarketStatusEnum.safeParse('pending').success).toBe(false)
    expect(ShippingMarketStatusEnum.safeParse('in_flight').success).toBe(false)
  })
})

describe('ShippingJobSchema', () => {
  const valid = {
    id: '11111111-1111-1111-1111-111111111111',
    sellerId: '22222222-2222-2222-2222-222222222222',
    status: 'running' as const,
    orderCount: 10,
    successCount: 4,
    failedCount: 2,
    errorSummary: null,
    createdAt: '2026-05-21T03:00:00.000Z',
    startedAt: '2026-05-21T03:01:00.000Z',
    completedAt: null,
  }

  it('유효 입력 parse 통과', () => {
    expect(ShippingJobSchema.safeParse(valid).success).toBe(true)
  })

  it('success + failed > orderCount 면 refine 실패', () => {
    const res = ShippingJobSchema.safeParse({
      ...valid,
      orderCount: 3,
      successCount: 3,
      failedCount: 2,
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['failedCount'])
    }
  })

  it('failedCount 음수면 parse 실패', () => {
    expect(
      ShippingJobSchema.safeParse({ ...valid, failedCount: -1 }).success,
    ).toBe(false)
  })
})

describe('ShippingJobResultSchema', () => {
  const valid = {
    id: '33333333-3333-3333-3333-333333333333',
    jobId: '44444444-4444-4444-4444-444444444444',
    orderId: '55555555-5555-5555-5555-555555555555',
    marketId: 'naver' as const,
    status: 'success' as const,
    externalDispatchId: 'DISPATCH-1',
    errorCode: null,
    errorMessage: null,
    attemptCount: 1,
    createdAt: '2026-05-21T03:00:00.000Z',
  }

  it('유효 입력 parse 통과', () => {
    expect(ShippingJobResultSchema.safeParse(valid).success).toBe(true)
  })

  it('attemptCount 0 이면 parse 실패 (min 1)', () => {
    expect(
      ShippingJobResultSchema.safeParse({ ...valid, attemptCount: 0 }).success,
    ).toBe(false)
  })

  it('정의되지 않은 marketId 거부', () => {
    expect(
      ShippingJobResultSchema.safeParse({
        ...valid,
        marketId: 'amazon' as unknown as 'naver',
      }).success,
    ).toBe(false)
  })
})

describe('ShippingDispatchPreviewSchema', () => {
  it('마켓 없이 totalOrders 0 도 통과 (empty 상태)', () => {
    expect(
      ShippingDispatchPreviewSchema.safeParse({
        totalOrders: 0,
        markets: [],
      }).success,
    ).toBe(true)
  })

  it('마켓별 분포 통과', () => {
    expect(
      ShippingDispatchPreviewSchema.safeParse({
        totalOrders: 7,
        markets: [
          { marketId: 'naver', orderCount: 3 },
          { marketId: 'coupang', orderCount: 4 },
        ],
      }).success,
    ).toBe(true)
  })

  it('orderCount 음수면 parse 실패', () => {
    expect(
      ShippingDispatchPreviewSchema.safeParse({
        totalOrders: 1,
        markets: [{ marketId: 'naver', orderCount: -1 }],
      }).success,
    ).toBe(false)
  })
})

describe('ShippingDispatchStartInputSchema', () => {
  const ids = ['66666666-6666-6666-6666-666666666666']

  it('orderIds 1개로 parse 통과 (triggeredByAutoSubmit default false)', () => {
    const res = ShippingDispatchStartInputSchema.safeParse({ orderIds: ids })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.triggeredByAutoSubmit).toBe(false)
    }
  })

  it('orderIds 빈 배열이면 parse 실패 (min 1)', () => {
    expect(
      ShippingDispatchStartInputSchema.safeParse({ orderIds: [] }).success,
    ).toBe(false)
  })

  it('orderIds 501개면 parse 실패 (max 500)', () => {
    const many = Array.from(
      { length: 501 },
      (_, i) =>
        `00000000-0000-0000-0000-${String(i).padStart(12, '0')}` as const,
    )
    expect(
      ShippingDispatchStartInputSchema.safeParse({ orderIds: many }).success,
    ).toBe(false)
  })

  it('orderIds 가 UUID 가 아니면 parse 실패', () => {
    expect(
      ShippingDispatchStartInputSchema.safeParse({
        orderIds: ['not-a-uuid'],
      }).success,
    ).toBe(false)
  })
})

describe('ShippingDispatchRetryInputSchema', () => {
  const jobId = '77777777-7777-7777-7777-777777777777'

  it('jobId 만으로 parse 통과 (orderIds default [])', () => {
    const res = ShippingDispatchRetryInputSchema.safeParse({ jobId })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.orderIds).toEqual([])
    }
  })

  it('jobId 가 UUID 가 아니면 parse 실패', () => {
    expect(
      ShippingDispatchRetryInputSchema.safeParse({ jobId: 'not-a-uuid' })
        .success,
    ).toBe(false)
  })
})
