/**
 * 쿠팡 Wing OpenAPI — fetchOrders 순수 헬퍼 (Edge Function / Deno 측).
 *
 * 프론트엔드 미러:
 *   apps/web/src/lib/markets/real/coupang/orders.ts (tested ground truth)
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1 (주문 자동 수집)
 *
 * 엔드포인트:
 *   - GET /v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets?status=ACCEPT&createdAtFrom=..&createdAtTo=..
 *     (v4 → v5 마이그레이션 — 응답이 nested orderer/receiver/Money 객체 형태로 변경됨;
 *      v4 flat shape 도 fallback 으로 수용)
 *
 * 본 파일은 외부 호출 없는 순수 헬퍼만 둔다 (zod 스키마 / status 정규화 / 매핑 / path 빌더).
 * 실 HTTP 호출은 coupang.ts 의 coupangFetch (HMAC 서명 + gateway) 가 담당.
 *
 * 보안 강제:
 *   - PII (ordererName / receiverName / receiverAddr / receiverPhoneNumber) 는 로그 금지.
 *     본 파일은 로깅 자체를 하지 않는다 (순수 변환).
 *   - 마켓 raw status ('ACCEPT' 등) 는 normalizeCoupangStatus 로 정규화 enum 변환.
 */

import { z } from 'npm:zod@3.23.8'
import {
  MarketOrderSchema,
  normalizeIsoOffset,
  type MarketOrder,
  type MarketOrderStatus,
} from '../market-orders.ts'

const MARKET = 'coupang' as const

// ─────────────────────────────────────────────
// Wing OpenAPI 주문 조회 응답 스키마
// ─────────────────────────────────────────────

/**
 * 쿠팡 Money 객체 — v5 부터 가격 필드가 { currencyCode, units, nanos } nested 로 변경.
 * v4 의 scalar number 도 fallback (mapCoupangOrders 의 moneyToKrw 가 처리).
 */
const CoupangMoneySchema = z.object({
  currencyCode: z.string().optional().default('KRW'),
  units: z.number().optional().default(0),
  nanos: z.number().optional().default(0),
})

const CoupangOrderItemEntrySchema = z.object({
  vendorItemName: z.string().optional().default(''),
  vendorItemId: z.number().optional(),
  shippingCount: z.number().int().nonnegative().optional().default(1),
  // v5: Money / v4: scalar number — union 으로 둘 다 수용.
  orderPrice: z.union([CoupangMoneySchema, z.number()]).optional(),
})

const CoupangOrdererSchema = z.object({
  name: z.string().optional().default(''),
  safeNumber: z.string().optional().default(''),
  ordererNumber: z.string().nullable().optional(),
})

const CoupangReceiverSchema = z.object({
  name: z.string().optional().default(''),
  safeNumber: z.string().optional().default(''),
  receiverNumber: z.string().nullable().optional(),
  addr1: z.string().optional().default(''),
  addr2: z.string().optional().default(''),
})

const CoupangOrderEntrySchema = z.object({
  shipmentBoxId: z.union([z.string(), z.number()]),
  orderId: z.union([z.string(), z.number()]).optional(),
  // v5 nested
  orderer: CoupangOrdererSchema.optional(),
  receiver: CoupangReceiverSchema.optional(),
  paidAt: z.string().optional(),
  // v4 flat (하위호환)
  ordererName: z.string().optional().default(''),
  receiverName: z.string().optional().default(''),
  receiverAddr1: z.string().optional().default(''),
  receiverAddr2: z.string().optional().default(''),
  receiverPhoneNumber: z.string().optional().default(''),
  orderItems: z.array(CoupangOrderItemEntrySchema).optional().default([]),
  status: z.string().optional().default('ACCEPT'),
  orderedAt: z.string().optional(),
})

export const CoupangOrderListResponseSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
  data: z.array(CoupangOrderEntrySchema).optional(),
  nextToken: z.string().optional(),
})

/**
 * v5 Money 또는 v4 scalar 를 KRW 정수로 정규화.
 */
function moneyToKrw(value: unknown): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'units' in value) {
    const units = (value as { units?: number }).units
    return typeof units === 'number' ? units : 0
  }
  return 0
}

export type CoupangOrderListResponse = z.infer<typeof CoupangOrderListResponseSchema>
type CoupangOrderEntry = z.infer<typeof CoupangOrderEntrySchema>

// ─────────────────────────────────────────────
// status 정규화
// ─────────────────────────────────────────────

export function normalizeCoupangStatus(raw: string): MarketOrderStatus {
  switch (raw) {
    case 'ACCEPT':
    case 'INSTRUCT':
      return 'new_pay'
    case 'DEPARTURE':
      return 'dispatched'
    case 'DELIVERING':
      return 'delivering'
    case 'FINAL_DELIVERY':
    case 'NONE_TRACKING':
      return 'delivered'
    case 'CANCEL':
    case 'CANCELED':
      return 'cancelled'
    case 'RETURNS':
      return 'returned'
    default:
      return 'unknown'
  }
}

// ─────────────────────────────────────────────
// ordersheets path 빌더 (query string 포함 — 쿠팡 HMAC 서명이 query 도 서명)
// ─────────────────────────────────────────────

/**
 * fetchOrders 페이징 follow-up 호출의 최대 페이지 수.
 *
 * v5 ordersheets 는 페이지당 최대 50건 (maxPerPage default 50). 10분 cron tick
 * 1회당 5 페이지 (= 250건) 까지만 수집하고, 초과분은 다음 tick 으로 미룬다.
 * - Lightsail Gateway timeout (15s) 와 Edge Function timeout 내 안전 마진 확보
 * - rate limit 1 페이지당 1회 호출 → 동일 vendor 의 동시 폴링 시 폭주 방지
 * - 셀러가 일시에 1000+ 건이 쌓이는 케이스는 next cron tick (10분 후) 으로 분산
 *
 * MAX 도달 시 호출자는 응답에 `truncated_due_to_max_pages: true` 마커를 로그하고
 * 다음 tick 에 더 좁은 since/until 윈도우로 재시도하면 된다.
 */
export const COUPANG_ORDERS_MAX_PAGES = 5

/**
 * ordersheets 조회 path 를 query string 포함하여 반환한다.
 *
 * Deno 측 buildCoupangSignature 는 path 를 '?' 로 분리해 query 까지 서명하므로,
 * query string 을 path 인자에 포함해 전달해야 한다 (프론트엔드와 서명 정책이 다름).
 *
 * @param nextToken — 다음 페이지 조회 token. 첫 호출에서는 undefined. 빈 문자열은
 *                    "마지막 페이지" 의미이므로 호출 전 종료 처리해야 한다 (이 함수는
 *                    nextToken 값을 그대로 query 에 포함만 한다).
 */
export function buildCoupangOrdersPath(
  vendorId: string,
  since?: string,
  until?: string,
  nextToken?: string,
): string {
  const query: Record<string, string> = { status: 'ACCEPT' }
  if (since) query.createdAtFrom = since
  if (until) query.createdAtTo = until
  if (nextToken) query.nextToken = nextToken

  const queryString = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  return `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(
    vendorId,
  )}/ordersheets?${queryString}`
}

// ─────────────────────────────────────────────
// 응답 → MarketOrder[] 매핑 (순수)
// ─────────────────────────────────────────────

export function mapCoupangOrders(
  items: CoupangOrderEntry[],
): MarketOrder[] {
  return items.map((item) => {
    // v5 nested orderer/receiver 우선, 없으면 v4 flat 필드 fallback.
    const ordererName = item.orderer?.name ?? item.ordererName
    const receiverName = item.receiver?.name ?? item.receiverName
    const receiverAddr1 = item.receiver?.addr1 ?? item.receiverAddr1
    const receiverAddr2 = item.receiver?.addr2 ?? item.receiverAddr2
    const receiverPhone =
      item.receiver?.safeNumber ||
      item.receiver?.receiverNumber ||
      item.receiverPhoneNumber

    const addr = [receiverAddr1, receiverAddr2]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join(' ')
    const first = item.orderItems[0]
    const totalAmount = item.orderItems.reduce(
      (sum, entry) => sum + moneyToKrw(entry.orderPrice) * entry.shippingCount,
      0,
    )

    // paidAt 과 orderedAt 분리 (2026-05-29 PR #246 잔여 정합).
    const paidAtField = item.paidAt
    const orderedAtField = item.orderedAt

    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: String(item.shipmentBoxId),
      buyerName: ordererName && ordererName.length > 0 ? ordererName : '미상',
      receiverName:
        receiverName && receiverName.length > 0 ? receiverName : '미상',
      receiverAddress: addr.length > 0 ? addr : '주소 없음',
      receiverPhone:
        receiverPhone && receiverPhone.length > 0
          ? receiverPhone
          : '연락처 없음',
      productName:
        first && first.vendorItemName.length > 0
          ? first.vendorItemName
          : '상품명 없음',
      quantity: first ? first.shippingCount : 1,
      orderAmount: totalAmount,
      status: normalizeCoupangStatus(item.status),
      paidAt: normalizeIsoOffset(paidAtField ?? orderedAtField),
      ...(orderedAtField !== undefined
        ? { orderedAt: normalizeIsoOffset(orderedAtField) }
        : {}),
      ...(first?.vendorItemId !== undefined
        ? { vendorItemId: String(first.vendorItemId) }
        : {}),
    }
    return MarketOrderSchema.parse(order)
  })
}
