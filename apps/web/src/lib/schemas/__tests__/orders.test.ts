import { describe, it, expect } from 'vitest'
import {
  ManualResolveWaybillSchema,
  OrdersFilterSchema,
  OrderShippingStatusSchema,
  OrdersSummarySchema,
} from '../orders'

describe('orders zod schemas', () => {
  describe('ManualResolveWaybillSchema', () => {
    it('통과: 12자리 숫자 운송장번호', () => {
      const r = ManualResolveWaybillSchema.safeParse({
        orderId: '11111111-1111-1111-1111-111111111111',
        waybillNumber: '123456789012',
      })
      expect(r.success).toBe(true)
    })

    it('실패: 8자리 미만 운송장번호', () => {
      const r = ManualResolveWaybillSchema.safeParse({
        orderId: '11111111-1111-1111-1111-111111111111',
        waybillNumber: '1234',
      })
      expect(r.success).toBe(false)
    })

    it('실패: 한글 포함 운송장번호', () => {
      const r = ManualResolveWaybillSchema.safeParse({
        orderId: '11111111-1111-1111-1111-111111111111',
        waybillNumber: '운송장12345',
      })
      expect(r.success).toBe(false)
    })
  })

  describe('OrdersFilterSchema', () => {
    it('통과: 빈 필터 → pageSize 50 기본', () => {
      const r = OrdersFilterSchema.safeParse({})
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.pageSize).toBe(50)
    })

    it('실패: 잘못된 marketId', () => {
      const r = OrdersFilterSchema.safeParse({ marketId: 'unknown-market' })
      expect(r.success).toBe(false)
    })
  })

  describe('OrderShippingStatusSchema', () => {
    it('통과: 5개 상태값 모두', () => {
      const all = [
        'collected',
        'logen_registered',
        'logen_failed',
        'waybill_printed',
        'tracking_submitted',
      ]
      for (const s of all) {
        expect(OrderShippingStatusSchema.safeParse(s).success).toBe(true)
      }
    })

    it('실패: 알 수 없는 상태값', () => {
      expect(OrderShippingStatusSchema.safeParse('returned').success).toBe(false)
    })
  })

  describe('OrdersSummarySchema', () => {
    it('통과: byMarket 빈 배열', () => {
      const r = OrdersSummarySchema.safeParse({
        newOrdersCount: 0,
        logenRegisteredCount: 0,
        waybillPendingCount: 0,
        dispatchSubmittedCount: 0,
        byMarket: [],
      })
      expect(r.success).toBe(true)
    })

    it('실패: 음수 카운트', () => {
      const r = OrdersSummarySchema.safeParse({
        newOrdersCount: -1,
        logenRegisteredCount: 0,
        waybillPendingCount: 0,
        dispatchSubmittedCount: 0,
        byMarket: [],
      })
      expect(r.success).toBe(false)
    })
  })
})
