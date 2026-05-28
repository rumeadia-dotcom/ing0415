/**
 * 쿠팡 fetchOrders 순수 헬퍼 단위 테스트 (Deno test).
 *
 * 프론트엔드 미러:
 *   apps/web/src/lib/markets/real/coupang/__tests__/coupang-orders.test.ts
 *
 * 본 spec 은 외부 호출 없는 순수 헬퍼 (normalizeCoupangStatus / mapCoupangOrders /
 * buildCoupangOrdersPath) 만 검증한다. HTTP 경로(coupangFetch + HMAC + gateway)는
 * coupang.ts 어댑터 통합 경로에서 다룬다.
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
  buildCoupangOrdersPath,
  CoupangOrderListResponseSchema,
  mapCoupangOrders,
  normalizeCoupangStatus,
} from '../coupang-orders.ts'

// ─────────────────────────────────────────────
// normalizeCoupangStatus
// ─────────────────────────────────────────────

Deno.test('normalizeCoupangStatus: ACCEPT → new_pay (mapped)', () => {
  assertEquals(normalizeCoupangStatus('ACCEPT'), 'new_pay')
})

Deno.test('normalizeCoupangStatus: FINAL_DELIVERY → delivered (mapped)', () => {
  assertEquals(normalizeCoupangStatus('FINAL_DELIVERY'), 'delivered')
})

Deno.test('normalizeCoupangStatus: 알 수 없는 raw → unknown', () => {
  assertEquals(normalizeCoupangStatus('WTF'), 'unknown')
})

// ─────────────────────────────────────────────
// buildCoupangOrdersPath
// ─────────────────────────────────────────────

Deno.test('buildCoupangOrdersPath: status=ACCEPT + since/until 쿼리 포함', () => {
  const path = buildCoupangOrdersPath(
    'A00012345',
    '2026-05-21T02:30:00+00:00',
    '2026-05-22T02:30:00+00:00',
  )
  assertEquals(
    path.startsWith(
      '/v2/providers/openapi/apis/api/v5/vendors/A00012345/ordersheets?',
    ),
    true,
  )
  // query 가 URL-encode 되어 포함되는지 (status + createdAtFrom + createdAtTo).
  assertEquals(path.includes('status=ACCEPT'), true)
  assertEquals(path.includes('createdAtFrom='), true)
  assertEquals(path.includes('createdAtTo='), true)
})

Deno.test('buildCoupangOrdersPath: since/until 없으면 status=ACCEPT 만', () => {
  const path = buildCoupangOrdersPath('A00012345')
  assertEquals(
    path,
    '/v2/providers/openapi/apis/api/v5/vendors/A00012345/ordersheets?status=ACCEPT',
  )
})

// ─────────────────────────────────────────────
// mapCoupangOrders — v5 nested shape (orderer/receiver/Money)
// ─────────────────────────────────────────────

const COUPANG_V5_RESPONSE = {
  code: 200,
  message: 'OK',
  data: [
    {
      shipmentBoxId: 333000111,
      orderId: 50000000001,
      orderedAt: '2026-05-21T02:30:00+00:00',
      paidAt: '2026-05-21T02:31:00+00:00',
      orderer: { name: '박영희', safeNumber: '+82-10-1111-2222' },
      receiver: {
        name: '박영희',
        safeNumber: '010-2222-3333',
        addr1: '인천광역시 연수구 송도과학로 1',
        addr2: '101동 1505호',
      },
      orderItems: [
        {
          vendorItemId: 12345,
          vendorItemName: '테스트 쿠팡 상품',
          shippingCount: 3,
          orderPrice: { currencyCode: 'KRW', units: 30000, nanos: 0 },
        },
      ],
      status: 'ACCEPT',
    },
  ],
}

Deno.test('mapCoupangOrders: v5 nested shape — orderer/receiver/Money 매핑', () => {
  const parsed = CoupangOrderListResponseSchema.parse(COUPANG_V5_RESPONSE)
  const orders = mapCoupangOrders(parsed.data ?? [])
  assertEquals(orders.length, 1)
  const order = orders[0]
  assertExists(order)
  MarketOrderSchema.parse(order)
  assertEquals(order.buyerName, '박영희')
  assertEquals(order.receiverName, '박영희')
  assertEquals(
    order.receiverAddress,
    '인천광역시 연수구 송도과학로 1 101동 1505호',
  )
  assertEquals(order.receiverPhone, '010-2222-3333')
  assertEquals(order.quantity, 3)
  assertEquals(order.orderAmount, 90_000)
})

// ─────────────────────────────────────────────
// mapCoupangOrders — happy path
// ─────────────────────────────────────────────

const COUPANG_HAPPY_RESPONSE = {
  code: '200',
  message: 'OK',
  data: [
    {
      shipmentBoxId: 333000111,
      orderId: 50000000001,
      ordererName: '박영희',
      receiverAddr1: '인천광역시 연수구 송도과학로 1',
      receiverAddr2: '101동 1505호',
      receiverName: '박영희',
      receiverPhoneNumber: '010-2222-3333',
      orderItems: [
        {
          vendorItemName: '테스트 쿠팡 상품',
          shippingCount: 3,
          orderPrice: 30000,
        },
      ],
      status: 'ACCEPT',
      orderedAt: '2026-05-21T02:30:00+00:00',
    },
  ],
}

Deno.test('mapCoupangOrders: happy — MarketOrder[] 정규화 + status=new_pay + 합산 금액', () => {
  const parsed = CoupangOrderListResponseSchema.parse(COUPANG_HAPPY_RESPONSE)
  const orders = mapCoupangOrders(parsed.data ?? [])
  assertEquals(orders.length, 1)
  const order = orders[0]
  assertExists(order)
  // 스키마 재검증 — throw 없으면 통과.
  MarketOrderSchema.parse(order)
  assertEquals(order.market, 'coupang')
  assertEquals(order.status, 'new_pay')
  assertEquals(order.externalOrderId, '333000111')
  assertEquals(order.quantity, 3)
  // 30000 * 3 = 90000
  assertEquals(order.orderAmount, 90_000)
  assertEquals(order.receiverAddress, '인천광역시 연수구 송도과학로 1 101동 1505호')
})

// ─────────────────────────────────────────────
// mapCoupangOrders — 빈 / 누락 필드 fallback
// ─────────────────────────────────────────────

Deno.test('mapCoupangOrders: 빈 배열 → 빈 결과', () => {
  const orders = mapCoupangOrders([])
  assertEquals(orders.length, 0)
})

Deno.test('mapCoupangOrders: 필드 누락 → fallback 문자열 + quantity 1', () => {
  const parsed = CoupangOrderListResponseSchema.parse({
    data: [{ shipmentBoxId: 999, status: 'ACCEPT' }],
  })
  const orders = mapCoupangOrders(parsed.data ?? [])
  assertEquals(orders.length, 1)
  const order = orders[0]
  assertExists(order)
  MarketOrderSchema.parse(order)
  assertEquals(order.externalOrderId, '999')
  assertEquals(order.buyerName, '미상')
  assertEquals(order.receiverName, '미상')
  assertEquals(order.receiverAddress, '주소 없음')
  assertEquals(order.receiverPhone, '연락처 없음')
  assertEquals(order.productName, '상품명 없음')
  assertEquals(order.quantity, 1)
  assertEquals(order.orderAmount, 0)
})
