import { describe, it, expect } from 'vitest'
import { mapDispatchStatus } from '../dispatch-status'
import { OrderSummarySchema } from '@/lib/schemas/orders'

/**
 * O1: list_orders / get_order RPC 는 market_dispatch_status 를
 *   shipping_job_results.status(enum: success|failed) 또는 결과행 없을 때 null 로 내려준다.
 *   UI 도메인(pending|submitted|failed)으로 매핑되어야 한다.
 * O2: orders.status 는 dispatch_failed 를 포함(6값)하므로 shippingStatus 도 이를 받아야 한다.
 */
describe('mapDispatchStatus (O1)', () => {
  it('null(미제출) → pending', () => {
    expect(mapDispatchStatus(null)).toBe('pending')
  })
  it('undefined → pending', () => {
    expect(mapDispatchStatus(undefined)).toBe('pending')
  })
  it('success → submitted', () => {
    expect(mapDispatchStatus('success')).toBe('submitted')
  })
  it('failed → failed', () => {
    expect(mapDispatchStatus('failed')).toBe('failed')
  })
  it('이미 UI 도메인 값이면 그대로 통과', () => {
    expect(mapDispatchStatus('submitted')).toBe('submitted')
    expect(mapDispatchStatus('pending')).toBe('pending')
  })
})

describe('OrderSummarySchema — dispatch_failed shippingStatus (O2)', () => {
  const ROW = {
    id: '11111111-1111-4111-8111-111111111111',
    externalOrderId: 'X-0001',
    marketId: 'naver' as const,
    productName: '여름 원피스',
    buyerMaskedName: '김**',
    shippingStatus: 'dispatch_failed' as const,
    marketDispatchStatus: 'failed' as const,
    waybillNumber: null,
    orderedAt: '2026-05-19T10:00:00+00:00',
    updatedAt: '2026-05-19T10:00:00+00:00',
  }
  it('dispatch_failed 가 parse 통과', () => {
    expect(OrderSummarySchema.safeParse(ROW).success).toBe(true)
  })
})
