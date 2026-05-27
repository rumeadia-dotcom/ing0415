/**
 * ESM (G마켓·옥션) fetchOrders 순수 헬퍼 단위 테스트 (Deno test).
 *
 * 프론트엔드 미러:
 *   apps/web/src/lib/markets/real/auction/__tests__/auction-orders.test.ts (site=A)
 *   apps/web/src/lib/markets/real/esm/orders.ts (공용 로직 ground truth)
 *
 * 본 spec 은 외부 호출 없는 순수 헬퍼 (normalizeEsmStatus / mapEsmOrders) 만 검증한다.
 * HTTP 경로(esmFetch + JWT + gateway) 및 site 검증은 esm-shared.ts 어댑터 경로에서 다룬다.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { MarketOrderSchema } from '../../market-orders.ts'
import {
  EsmOrderListResponseSchema,
  mapEsmOrders,
  normalizeEsmStatus,
} from '../esm-orders.ts'

// ─────────────────────────────────────────────
// normalizeEsmStatus
// ─────────────────────────────────────────────

Deno.test('normalizeEsmStatus: PAID → new_pay (mapped)', () => {
  assertEquals(normalizeEsmStatus('PAID'), 'new_pay')
})

Deno.test('normalizeEsmStatus: DELIVERED → delivered (mapped)', () => {
  assertEquals(normalizeEsmStatus('DELIVERED'), 'delivered')
})

Deno.test('normalizeEsmStatus: 알 수 없는 raw → unknown', () => {
  assertEquals(normalizeEsmStatus('NOPE'), 'unknown')
})

// ─────────────────────────────────────────────
// mapEsmOrders — happy path (site=A / market=auction)
// ─────────────────────────────────────────────

const ESM_HAPPY_RESPONSE = {
  resultCode: '0000',
  resultMessage: 'OK',
  data: {
    orders: [
      {
        orderNo: 'ESM-AUCTION-0001',
        buyerName: '정민호',
        receiverName: '정민호',
        receiverZipCode: '03187',
        receiverAddress: '서울특별시 종로구 종로 1',
        receiverPhone: '010-5555-6666',
        itemName: '옥션 테스트 상품',
        orderQty: 2,
        orderPrice: 12000,
        orderStatus: 'PAID',
        paidDate: '2026-05-21T05:00:00+00:00',
      },
    ],
  },
}

Deno.test('mapEsmOrders: happy — MarketOrder[] 정규화 (market=auction)', () => {
  const parsed = EsmOrderListResponseSchema.parse(ESM_HAPPY_RESPONSE)
  const orders = mapEsmOrders(parsed.data?.orders ?? [], 'auction')
  assertEquals(orders.length, 1)
  const order = orders[0]
  assertExists(order)
  MarketOrderSchema.parse(order)
  assertEquals(order.market, 'auction')
  assertEquals(order.status, 'new_pay')
  assertEquals(order.externalOrderId, 'ESM-AUCTION-0001')
  assertEquals(order.quantity, 2)
  assertEquals(order.orderAmount, 12000)
})

Deno.test('mapEsmOrders: market=gmarket 전달 시 그대로 매핑', () => {
  const parsed = EsmOrderListResponseSchema.parse(ESM_HAPPY_RESPONSE)
  const orders = mapEsmOrders(parsed.data?.orders ?? [], 'gmarket')
  const order = orders[0]
  assertExists(order)
  assertEquals(order.market, 'gmarket')
})

// ─────────────────────────────────────────────
// mapEsmOrders — 빈 / 누락 필드 fallback
// ─────────────────────────────────────────────

Deno.test('mapEsmOrders: 빈 배열 → 빈 결과', () => {
  const orders = mapEsmOrders([], 'gmarket')
  assertEquals(orders.length, 0)
})

Deno.test('mapEsmOrders: 필드 누락 → fallback 문자열 + quantity 1', () => {
  const parsed = EsmOrderListResponseSchema.parse({
    data: { orders: [{ orderNo: 777 }] },
  })
  const orders = mapEsmOrders(parsed.data?.orders ?? [], 'auction')
  assertEquals(orders.length, 1)
  const order = orders[0]
  assertExists(order)
  MarketOrderSchema.parse(order)
  assertEquals(order.externalOrderId, '777')
  assertEquals(order.buyerName, '미상')
  assertEquals(order.receiverName, '미상')
  assertEquals(order.receiverAddress, '주소 없음')
  assertEquals(order.receiverPhone, '연락처 없음')
  assertEquals(order.productName, '상품명 없음')
  assertEquals(order.quantity, 1)
  assertEquals(order.orderAmount, 0)
  // orderStatus 기본값 'PAID' → new_pay
  assertEquals(order.status, 'new_pay')
})
