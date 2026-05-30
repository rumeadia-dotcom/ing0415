import { describe, expect, it } from 'vitest'
import { toOrderUpsertRow } from '../lib/orders-repo-row'
import type { MarketOrder } from '../lib/adapter-shape'

const NOW = '2026-05-30T00:00:00.000Z'

function makeOrder(over: Partial<MarketOrder> = {}): MarketOrder {
  return {
    externalOrderId: 'ORD-1',
    buyerName: '홍길동',
    receiverName: '수령자',
    receiverAddress: '서울시 강남구',
    receiverPhone: '010-0000-0000',
    productName: '테스트 상품',
    quantity: 2,
    orderAmount: 20000,
    status: 'new_pay',
    paidAt: '2026-05-20T10:00:00+09:00',
    market: '11st',
    ...over,
  }
}

describe('toOrderUpsertRow (orders upsert row 빌드 — PRD §4 컬럼 정합)', () => {
  it('PRD §4 핵심 컬럼 + collected_at(now)/paid_at 매핑', () => {
    const row = toOrderUpsertRow(
      { sellerId: 'SELLER-1', marketId: '11st', order: makeOrder() },
      NOW,
    )
    expect(row.seller_id).toBe('SELLER-1')
    expect(row.market_id).toBe('11st')
    expect(row.external_order_id).toBe('ORD-1')
    expect(row.status).toBe('collected')
    expect(row.quantity).toBe(2)
    expect(row.order_amount).toBe(20000)
    expect(row.collected_at).toBe(NOW)
    expect(row.paid_at).toBe('2026-05-20T10:00:00+09:00')
  })

  it('NEW-1: 11번가 extra.dlvNo 를 row.extra 에 보존', () => {
    const row = toOrderUpsertRow(
      {
        sellerId: 'SELLER-1',
        marketId: '11st',
        order: makeOrder({ extra: { dlvNo: 'DLV-999' } }),
      },
      NOW,
    )
    expect(row.extra).toEqual({ dlvNo: 'DLV-999' })
  })

  it('extra 없는 마켓 → row.extra = null', () => {
    const row = toOrderUpsertRow(
      { sellerId: 'SELLER-1', marketId: 'naver', order: makeOrder({ market: 'naver' }) },
      NOW,
    )
    expect(row.extra).toBeNull()
  })

  it('쿠팡 vendor_item_id 는 별도 컬럼 유지 (extra 와 무관)', () => {
    const row = toOrderUpsertRow(
      {
        sellerId: 'SELLER-1',
        marketId: 'coupang',
        order: makeOrder({ market: 'coupang', vendorItemId: 'VI-1' }),
      },
      NOW,
    )
    expect(row.vendor_item_id).toBe('VI-1')
    expect(row.extra).toBeNull()
  })
})
