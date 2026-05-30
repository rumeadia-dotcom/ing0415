/**
 * orders 테이블 upsert row 빌더 (순수 함수 — vitest 직접 커버).
 *
 * 마스터: PRD.md §4 (orders 컬럼) + 마이그 20260529000001(vendor_item_id/ordered_at/paid_at)
 *         + 20260530000003(extra jsonb — NEW-1 dlvNo plumbing).
 *
 * deno.land/npm 런타임 import 없음 (type-only) — orders-repo.ts(Edge)·vitest 양쪽에서 사용.
 */

import type { MarketId } from '../../_shared/index.ts'
import type { MarketOrder } from './adapter-shape.ts'

export interface UpsertOrderInput {
  sellerId: string
  marketId: MarketId
  order: MarketOrder
}

/** PRD §4 orders 컬럼 정합 row (id/updated_at 은 DB default). */
export interface OrderUpsertRow {
  seller_id: string
  market_id: MarketId
  external_order_id: string
  buyer_name: MarketOrder['buyerName']
  receiver_name: string
  receiver_address: string
  receiver_phone: string
  product_name: string
  quantity: number
  order_amount: number
  status: 'collected'
  collected_at: string
  paid_at: MarketOrder['paidAt']
  ordered_at: NonNullable<MarketOrder['orderedAt']> | null
  vendor_item_id: NonNullable<MarketOrder['vendorItemId']> | null
  /** 마켓별 발송 보조키 (NEW-1) — 11번가 dlvNo. 어댑터 MarketOrder.extra 그대로. */
  extra: Record<string, string> | null
}

/**
 * MarketOrder → orders upsert row.
 *   - status 는 수집 시점 항상 'collected' (PRD §4).
 *   - collected_at = 우리 시스템 수집 시각(nowIso), paid_at = 마켓 결제완료 시각.
 *   - extra = 마켓별 발송 보조키 (11번가 dlvNo). 없으면 null.
 */
export function toOrderUpsertRow(input: UpsertOrderInput, nowIso: string): OrderUpsertRow {
  const { order } = input
  return {
    seller_id: input.sellerId,
    market_id: input.marketId,
    external_order_id: order.externalOrderId,
    buyer_name: order.buyerName,
    receiver_name: order.receiverName,
    receiver_address: order.receiverAddress,
    receiver_phone: order.receiverPhone,
    product_name: order.productName,
    quantity: order.quantity,
    order_amount: order.orderAmount,
    status: 'collected',
    collected_at: nowIso,
    paid_at: order.paidAt,
    ordered_at: order.orderedAt ?? null,
    vendor_item_id: order.vendorItemId ?? null,
    extra: order.extra ?? null,
  }
}
