/**
 * ESM (G마켓·옥션) 주문조회·발송처리 순수 헬퍼 단위 테스트 (Deno test).
 *
 * 프론트엔드 미러:
 *   apps/web/src/lib/markets/real/auction/__tests__/auction-orders.test.ts (site=A)
 *   apps/web/src/lib/markets/real/esm/orders.ts (공용 로직 ground truth)
 *
 * 본 spec 은 외부 호출 없는 순수 헬퍼 (normalizeEsmStatus / mapEsmOrders /
 * isEsmSuccessCode / buildEsm*Body) 만 검증한다. HTTP 경로(esmFetch + JWT + gateway)
 * 및 site 검증은 esm-shared.ts 어댑터 경로에서 다룬다.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - docs/architecture/v1/features/esm.md
 *   - esm-api/order-shipping/67.md (주문조회) / 70.md (발송처리)
 *   - PRD.md §6.1, §6.4
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { MarketOrderSchema } from '../../market-orders.ts'
import {
  buildEsmOrderListBody,
  buildEsmShipInfoBody,
  EsmOrderListResponseSchema,
  isEsmSuccessCode,
  mapEsmOrders,
  normalizeEsmStatus,
  siteToSiteType,
} from '../esm-orders.ts'

// ─────────────────────────────────────────────
// normalizeEsmStatus (OrderStatus int — 67.md)
// ─────────────────────────────────────────────

Deno.test('normalizeEsmStatus: 1 신규주문 → new_pay', () => {
  assertEquals(normalizeEsmStatus(1), 'new_pay')
})

Deno.test('normalizeEsmStatus: 2 발송대기중 → new_pay', () => {
  assertEquals(normalizeEsmStatus(2), 'new_pay')
})

Deno.test('normalizeEsmStatus: 3 배송중 → delivering', () => {
  assertEquals(normalizeEsmStatus(3), 'delivering')
})

Deno.test('normalizeEsmStatus: 4 배송완료 → delivered', () => {
  assertEquals(normalizeEsmStatus(4), 'delivered')
})

Deno.test('normalizeEsmStatus: 알 수 없는 raw → unknown', () => {
  assertEquals(normalizeEsmStatus(99), 'unknown')
  assertEquals(normalizeEsmStatus(undefined), 'unknown')
})

// ─────────────────────────────────────────────
// isEsmSuccessCode
// ─────────────────────────────────────────────

Deno.test('isEsmSuccessCode: 0 / "0" / "Success" → true', () => {
  assertEquals(isEsmSuccessCode(0), true)
  assertEquals(isEsmSuccessCode('0'), true)
  assertEquals(isEsmSuccessCode('Success'), true)
  assertEquals(isEsmSuccessCode('success'), true)
})

Deno.test('isEsmSuccessCode: 3000 / undefined → false', () => {
  assertEquals(isEsmSuccessCode(3000), false)
  assertEquals(isEsmSuccessCode('3000'), false)
  assertEquals(isEsmSuccessCode(undefined), false)
})

// ─────────────────────────────────────────────
// siteToSiteType
// ─────────────────────────────────────────────

Deno.test('siteToSiteType: A → 1 (옥션), G → 2 (G마켓)', () => {
  assertEquals(siteToSiteType('A'), 1)
  assertEquals(siteToSiteType('G'), 2)
})

// ─────────────────────────────────────────────
// mapEsmOrders — happy path (esm-api/.../67.md 실제 응답 형태)
// ─────────────────────────────────────────────

const ESM_HAPPY_RESPONSE = {
  ResultCode: 0,
  Message: '',
  Data: {
    SiteType: 1,
    TotalCount: 1,
    SellerId: 'test',
    RequestOrders: [
      {
        OrderNo: 1589617617,
        OrderStatus: 1,
        BuyerName: '정민호',
        ReceiverName: '정민호',
        ZipCode: '03187',
        DelFullAddress: '서울특별시 종로구 종로 1',
        HpNo: '010-5555-6666',
        GoodsName: '옥션 테스트 상품',
        ContrAmount: 2,
        OrderAmount: '12000.0000',
        OrderDate: '2026-05-21T05:00:00',
        PayDate: '2026-05-21T05:00:00',
      },
    ],
  },
}

Deno.test('mapEsmOrders: happy — MarketOrder[] 정규화 (market=auction)', () => {
  const parsed = EsmOrderListResponseSchema.parse(ESM_HAPPY_RESPONSE)
  const orders = mapEsmOrders(parsed.Data?.RequestOrders ?? [], 'auction')
  assertEquals(orders.length, 1)
  const order = orders[0]
  assertExists(order)
  MarketOrderSchema.parse(order)
  assertEquals(order.market, 'auction')
  assertEquals(order.status, 'new_pay')
  assertEquals(order.externalOrderId, '1589617617')
  assertEquals(order.quantity, 2)
  // "12000.0000" → 12000 정수 파싱
  assertEquals(order.orderAmount, 12000)
  assertEquals(order.receiverPhone, '010-5555-6666')
})

Deno.test('mapEsmOrders: market=gmarket 전달 시 그대로 매핑', () => {
  const parsed = EsmOrderListResponseSchema.parse(ESM_HAPPY_RESPONSE)
  const orders = mapEsmOrders(parsed.Data?.RequestOrders ?? [], 'gmarket')
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
    Data: { RequestOrders: [{ OrderNo: 777 }] },
  })
  const orders = mapEsmOrders(parsed.Data?.RequestOrders ?? [], 'auction')
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
  // OrderStatus 누락 → unknown
  assertEquals(order.status, 'unknown')
})

Deno.test('mapEsmOrders: DelFullAddress 없으면 Front+Back 조합', () => {
  const parsed = EsmOrderListResponseSchema.parse({
    Data: {
      RequestOrders: [
        {
          OrderNo: 888,
          DelFrontAddress: '서울특별시 강남구 역삼동 804',
          DelBackAddress: '강남지점',
        },
      ],
    },
  })
  const orders = mapEsmOrders(parsed.Data?.RequestOrders ?? [], 'gmarket')
  const order = orders[0]
  assertExists(order)
  assertEquals(order.receiverAddress, '서울특별시 강남구 역삼동 804 강남지점')
})

// ─────────────────────────────────────────────
// buildEsmOrderListBody — 요청 body (67.md)
// ─────────────────────────────────────────────

Deno.test('buildEsmOrderListBody: site=A → siteType=1, 결제완료(1) 조회', () => {
  const body = buildEsmOrderListBody({
    site: 'A',
    since: '2026-05-01T00:00:00+00:00',
    until: '2026-05-08T00:00:00+00:00',
  })
  assertEquals(body.siteType, 1)
  assertEquals(body.orderStatus, 1)
  assertEquals(body.requestDateType, 2)
  assertEquals(body.requestDateFrom, '2026-05-01 00:00')
  assertEquals(body.requestDateTo, '2026-05-08 00:00')
  assertEquals(body.pageIndex, 1)
  assertEquals(body.pageSize, 100)
})

// ─────────────────────────────────────────────
// buildEsmShipInfoBody — 발송처리 body (70.md, 142.md 택배사 코드)
// ─────────────────────────────────────────────

Deno.test('buildEsmShipInfoBody: LOGEN → DeliveryCompanyCode 10003', () => {
  const body = buildEsmShipInfoBody({
    externalOrderId: '1589617617',
    waybillNumber: '444455556666',
    carrierCode: 'LOGEN',
    shippingDate: '2026-05-22T10:00:00',
  })
  assertEquals(body.OrderNo, '1589617617')
  assertEquals(body.DeliveryCompanyCode, 10003)
  assertEquals(body.InvoiceNo, '444455556666')
  assertEquals(body.ShippingDate, '2026-05-22T10:00:00')
})

Deno.test('buildEsmShipInfoBody: 미지원 택배사 → throw', () => {
  let threw = false
  try {
    buildEsmShipInfoBody({
      externalOrderId: '1',
      waybillNumber: '2',
      carrierCode: 'NOPE',
    })
  } catch {
    threw = true
  }
  assertEquals(threw, true)
})
