import { describe, it, expect } from 'vitest'
import {
  OrderStatusEnum,
  OrderSchema,
  OrderListFilterSchema,
  ManualWaybillResolveInputSchema,
  ORDER_STATUSES,
} from '@/lib/schemas/orders'

/**
 * v2 주문 도메인 zod 스키마 단위 테스트.
 *
 * 마스터:
 *  - docs/spec/PRD.md §6.1 / §8 (orders DDL / 상태 ENUM)
 *  - docs/architecture/v1/testing.md §6.1 (pass 1 + fail ≥1)
 */

describe('OrderStatusEnum (6상태)', () => {
  it('6개 유효 값 모두 parse 통과', () => {
    for (const s of ORDER_STATUSES) {
      expect(OrderStatusEnum.parse(s)).toBe(s)
    }
  })

  it('정의되지 않은 상태(shipped) parse 실패', () => {
    expect(OrderStatusEnum.safeParse('shipped').success).toBe(false)
  })

  it('null / 빈 문자열 / undefined parse 실패', () => {
    expect(OrderStatusEnum.safeParse('').success).toBe(false)
    expect(OrderStatusEnum.safeParse(null).success).toBe(false)
    expect(OrderStatusEnum.safeParse(undefined).success).toBe(false)
  })
})

describe('OrderSchema', () => {
  const valid = {
    id: '11111111-1111-1111-1111-111111111111',
    sellerId: '22222222-2222-2222-2222-222222222222',
    marketId: 'naver' as const,
    externalOrderId: 'EXT-001',
    buyerName: '구매자',
    receiverName: '수취인',
    receiverAddress: '서울시 강남구',
    receiverPhone: '010-1234-5678',
    productName: '텀블러',
    quantity: 1,
    orderAmount: 15000,
    status: 'collected' as const,
    logenOrderId: null,
    waybillNumber: null,
    carrierCode: 'LOGEN',
    errorCode: null,
    errorMessage: null,
    attemptCount: 0,
    collectedAt: '2026-05-21T03:00:00.000Z',
    logenRegisteredAt: null,
    waybillPrintedAt: null,
    dispatchedAt: null,
    createdAt: '2026-05-21T03:00:00.000Z',
    updatedAt: '2026-05-21T03:00:00.000Z',
  }

  it('유효 입력 parse 통과', () => {
    expect(OrderSchema.safeParse(valid).success).toBe(true)
  })

  it('quantity 0 이면 parse 실패 (min 1)', () => {
    expect(
      OrderSchema.safeParse({ ...valid, quantity: 0 }).success,
    ).toBe(false)
  })

  it('orderAmount 음수면 parse 실패', () => {
    expect(
      OrderSchema.safeParse({ ...valid, orderAmount: -1 }).success,
    ).toBe(false)
  })

  it('정의되지 않은 marketId 면 parse 실패', () => {
    expect(
      OrderSchema.safeParse({
        ...valid,
        marketId: 'amazon' as unknown as 'naver',
      }).success,
    ).toBe(false)
  })

  it('attemptCount 6 이면 parse 실패 (max 5)', () => {
    expect(
      OrderSchema.safeParse({ ...valid, attemptCount: 6 }).success,
    ).toBe(false)
  })
})

describe('OrderListFilterSchema', () => {
  it('빈 객체 parse 통과 (limit 20 default, offset 0 default)', () => {
    const res = OrderListFilterSchema.safeParse({})
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.limit).toBe(20)
      expect(res.data.offset).toBe(0)
    }
  })

  it('marketId / status 조합 parse 통과', () => {
    expect(
      OrderListFilterSchema.safeParse({
        marketId: 'coupang',
        status: 'logen_registered',
        keyword: '텀블러',
        limit: 50,
        offset: 100,
      }).success,
    ).toBe(true)
  })

  it('limit 0 이면 parse 실패 (min 1)', () => {
    expect(OrderListFilterSchema.safeParse({ limit: 0 }).success).toBe(false)
  })

  it('limit 101 이면 parse 실패 (max 100)', () => {
    expect(OrderListFilterSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('dateFrom > dateTo 면 refine 실패', () => {
    const res = OrderListFilterSchema.safeParse({
      dateFrom: '2026-05-22T00:00:00.000Z',
      dateTo: '2026-05-21T00:00:00.000Z',
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['dateTo'])
    }
  })
})

describe('ManualWaybillResolveInputSchema', () => {
  const valid = {
    orderId: '33333333-3333-3333-3333-333333333333',
    waybillNumber: 'WB-12345678',
  }

  it('필수 필드만으로 parse 통과 (carrierCode default LOGEN)', () => {
    const res = ManualWaybillResolveInputSchema.safeParse(valid)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.carrierCode).toBe('LOGEN')
    }
  })

  it('waybillNumber 가 빈 문자열이면 parse 실패', () => {
    expect(
      ManualWaybillResolveInputSchema.safeParse({
        ...valid,
        waybillNumber: '',
      }).success,
    ).toBe(false)
  })

  it('orderId 가 UUID 가 아니면 parse 실패', () => {
    expect(
      ManualWaybillResolveInputSchema.safeParse({
        ...valid,
        orderId: 'not-a-uuid',
      }).success,
    ).toBe(false)
  })
})
