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
 *   - GET /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets?status=ACCEPT&createdAtFrom=..&createdAtTo=..
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

const CoupangOrderItemEntrySchema = z.object({
  vendorItemName: z.string().optional().default(''),
  shippingCount: z.number().int().nonnegative().optional().default(1),
  orderPrice: z.number().int().nonnegative().optional().default(0),
})

const CoupangOrderEntrySchema = z.object({
  shipmentBoxId: z.union([z.string(), z.number()]),
  orderId: z.union([z.string(), z.number()]).optional(),
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
})

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
 * ordersheets 조회 path 를 query string 포함하여 반환한다.
 *
 * Deno 측 buildCoupangSignature 는 path 를 '?' 로 분리해 query 까지 서명하므로,
 * query string 을 path 인자에 포함해 전달해야 한다 (프론트엔드와 서명 정책이 다름).
 */
export function buildCoupangOrdersPath(
  vendorId: string,
  since?: string,
  until?: string,
): string {
  const query: Record<string, string> = { status: 'ACCEPT' }
  if (since) query.createdAtFrom = since
  if (until) query.createdAtTo = until

  const queryString = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  return `/v2/providers/openapi/apis/api/v4/vendors/${encodeURIComponent(
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
    const addr = [item.receiverAddr1, item.receiverAddr2]
      .filter((s) => s.length > 0)
      .join(' ')
    const first = item.orderItems[0]
    const totalAmount = item.orderItems.reduce(
      (sum, entry) => sum + entry.orderPrice * entry.shippingCount,
      0,
    )

    const order: MarketOrder = {
      market: MARKET,
      externalOrderId: String(item.shipmentBoxId),
      buyerName: item.ordererName.length > 0 ? item.ordererName : '미상',
      receiverName: item.receiverName.length > 0 ? item.receiverName : '미상',
      receiverAddress: addr.length > 0 ? addr : '주소 없음',
      receiverPhone:
        item.receiverPhoneNumber.length > 0
          ? item.receiverPhoneNumber
          : '연락처 없음',
      productName:
        first && first.vendorItemName.length > 0
          ? first.vendorItemName
          : '상품명 없음',
      quantity: first ? first.shippingCount : 1,
      orderAmount: totalAmount,
      status: normalizeCoupangStatus(item.status),
      paidAt: normalizeIsoOffset(item.orderedAt),
    }
    return MarketOrderSchema.parse(order)
  })
}
