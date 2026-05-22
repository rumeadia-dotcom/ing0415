import { describe, it, expect } from 'vitest'
import {
  OrderStatusEnum,
  OrderSchema,
  OrdersFilterSchema,
  ManualResolveWaybillSchema,
  ORDER_STATUSES,
} from '@/lib/schemas/orders'

/**
 * v2 주문 도메인 zod 스키마 단위 테스트.
 *
 * 마스터:
 *  - docs/spec/PRD.md §6.1 / §8 (orders DDL / 상태 ENUM)
 *  - docs/architecture/v1/testing.md §6.1 (pass 1 + fail ≥1)
 *
 * 정합 갱신 (2026-05-21):
 *  - 페이징은 keyset cursor (PR8 채택). offset 기반 OrderListFilterSchema 제거.
 *  - 수동 송장 보정은 ManualResolveWaybillSchema 단일 — carrierCode 는 DB 책임.
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

describe('OrdersFilterSchema (keyset cursor)', () => {
  it('빈 객체 parse 통과 (pageSize 50 default, cursor 없음)', () => {
    const res = OrdersFilterSchema.safeParse({})
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.pageSize).toBe(50)
      expect(res.data.cursor).toBeUndefined()
      expect(res.data.cursorId).toBeUndefined()
    }
  })

  it('marketId / status / cursor 조합 parse 통과', () => {
    const res = OrdersFilterSchema.safeParse({
      marketId: 'coupang',
      status: 'logen_registered',
      q: '텀블러',
      pageSize: 20,
      cursor: '2026-05-20T10:00:00.000Z',
      cursorId: '44444444-4444-4444-4444-444444444444',
    })
    expect(res.success).toBe(true)
  })

  it('pageSize 0 이면 parse 실패 (min 1)', () => {
    expect(OrdersFilterSchema.safeParse({ pageSize: 0 }).success).toBe(false)
  })

  it('pageSize 101 이면 parse 실패 (max 100)', () => {
    expect(OrdersFilterSchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })

  it('from > to 면 refine 실패', () => {
    const res = OrdersFilterSchema.safeParse({
      from: '2026-05-22T00:00:00.000Z',
      to: '2026-05-21T00:00:00.000Z',
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['to'])
    }
  })

  it('pageSize 가 number 가 아니면 parse 실패 (잘못된 cursor 페이로드)', () => {
    expect(
      OrdersFilterSchema.safeParse({ pageSize: 'twenty' }).success,
    ).toBe(false)
  })

  it('status 가 OrderShippingStatus 외 값(dispatch_failed)이면 parse 실패', () => {
    // dispatch_failed 는 marketDispatchStatus 측 실패라 shippingStatus 필터로는 받지 않는다.
    expect(
      OrdersFilterSchema.safeParse({ status: 'dispatch_failed' }).success,
    ).toBe(false)
  })
})

describe('ManualResolveWaybillSchema', () => {
  const valid = {
    orderId: '33333333-3333-3333-3333-333333333333',
    waybillNumber: 'WB-12345678',
  }

  it('필수 필드만으로 parse 통과 (carrierCode 는 DB 책임이라 입력 없음)', () => {
    const res = ManualResolveWaybillSchema.safeParse(valid)
    expect(res.success).toBe(true)
    if (res.success) {
      // schema 에 carrierCode 가 없음 — DB 가 LOGEN 으로 보정.
      expect('carrierCode' in res.data).toBe(false)
    }
  })

  it('note (옵션) 포함 parse 통과', () => {
    const res = ManualResolveWaybillSchema.safeParse({
      ...valid,
      note: '로젠 콜센터 수기 발급',
    })
    expect(res.success).toBe(true)
  })

  it('waybillNumber 가 8자 미만이면 parse 실패', () => {
    expect(
      ManualResolveWaybillSchema.safeParse({
        ...valid,
        waybillNumber: 'WB-123',
      }).success,
    ).toBe(false)
  })

  it('orderId 가 UUID 가 아니면 parse 실패', () => {
    expect(
      ManualResolveWaybillSchema.safeParse({
        ...valid,
        orderId: 'not-a-uuid',
      }).success,
    ).toBe(false)
  })
})
