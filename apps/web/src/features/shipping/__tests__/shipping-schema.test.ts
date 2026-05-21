import { describe, it, expect } from 'vitest'
import {
  ShippingPrintOrderSchema,
  ShippingDispatchPreviewSchema,
  ShippingJobSchema,
  ShippingJobMarketResultSchema,
  ShippingDispatchStartRequestSchema,
  ShippingDispatchRetryRequestSchema,
  MarkWaybillPrintedRequestSchema,
} from '../types/shipping-schema'

describe('shipping-schema (zod)', () => {
  it('ShippingPrintOrderSchema: pass valid + fail invalid market', () => {
    const valid = {
      orderId: '00000000-0000-0000-0000-000000000001',
      marketId: 'naver',
      marketOrderNo: 'NV-1',
      productName: '상품',
      buyerName: '홍길동',
      waybillNumber: 'WB1',
      shippingStatus: 'logen_registered',
      registeredAt: '2026-05-20T00:00:00.000Z',
    }
    expect(ShippingPrintOrderSchema.parse(valid)).toEqual(valid)
    expect(() =>
      ShippingPrintOrderSchema.parse({ ...valid, marketId: 'unknown' }),
    ).toThrow()
  })

  it('ShippingDispatchPreviewSchema: pass + fail negative count', () => {
    expect(
      ShippingDispatchPreviewSchema.parse({
        totalOrders: 5,
        printedOrders: 5,
        unprintedOrders: 0,
        marketGroups: [{ marketId: 'naver', orderCount: 5 }],
      }),
    ).toBeDefined()
    expect(() =>
      ShippingDispatchPreviewSchema.parse({
        totalOrders: -1,
        printedOrders: 0,
        unprintedOrders: 0,
        marketGroups: [],
      }),
    ).toThrow()
  })

  it('ShippingJobSchema: pass + fail invalid status', () => {
    const valid = {
      id: '00000000-0000-0000-0000-000000000001',
      sellerId: '00000000-0000-0000-0000-000000000002',
      status: 'running',
      totalOrders: 1,
      retryCount: 0,
      errorSummary: null,
      parentJobId: null,
      createdAt: '2026-05-20T00:00:00.000Z',
      startedAt: null,
      completedAt: null,
    }
    expect(ShippingJobSchema.parse(valid)).toEqual(valid)
    expect(() => ShippingJobSchema.parse({ ...valid, status: 'bogus' })).toThrow()
  })

  it('ShippingJobMarketResultSchema: attemptCount 범위', () => {
    const base = {
      id: '00000000-0000-0000-0000-000000000001',
      jobId: '00000000-0000-0000-0000-000000000002',
      marketId: 'naver' as const,
      marketAccountId: '00000000-0000-0000-0000-000000000003',
      status: 'success' as const,
      totalOrders: 5,
      successOrders: 5,
      failedOrders: 0,
      errorCode: null,
      errorMessage: null,
      attemptCount: 1,
      lastAttemptedAt: null,
    }
    expect(ShippingJobMarketResultSchema.parse(base)).toEqual(base)
    expect(() => ShippingJobMarketResultSchema.parse({ ...base, attemptCount: 5 })).toThrow()
  })

  it('ShippingDispatchStartRequestSchema: 빈 marketIds 거부', () => {
    expect(ShippingDispatchStartRequestSchema.parse({})).toEqual({})
    expect(() => ShippingDispatchStartRequestSchema.parse({ marketIds: [] })).toThrow()
  })

  it('ShippingDispatchRetryRequestSchema: jobId 필수', () => {
    expect(() => ShippingDispatchRetryRequestSchema.parse({})).toThrow()
    expect(
      ShippingDispatchRetryRequestSchema.parse({
        jobId: '00000000-0000-0000-0000-000000000001',
      }),
    ).toBeDefined()
  })

  it('MarkWaybillPrintedRequestSchema: 빈 orderIds 거부', () => {
    expect(() => MarkWaybillPrintedRequestSchema.parse({ orderIds: [] })).toThrow()
    expect(
      MarkWaybillPrintedRequestSchema.parse({
        orderIds: ['00000000-0000-0000-0000-000000000001'],
      }),
    ).toBeDefined()
  })
})
