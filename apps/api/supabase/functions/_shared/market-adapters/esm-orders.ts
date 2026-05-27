/**
 * ESM 2.0 (G마켓·옥션) — fetchOrders 순수 헬퍼 (Edge Function / Deno 측).
 *
 * 프론트엔드 미러:
 *   apps/web/src/lib/markets/real/esm/orders.ts (tested ground truth)
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD.md §6.1 (주문 자동 수집)
 *
 * ESM 2.0 getOrderList: GET /order?site=G|A&sellerId=..&from=..&to=..
 *
 * 본 파일은 외부 호출 없는 순수 헬퍼만 둔다 (zod 스키마 / status 정규화 / 매핑).
 * 실 HTTP 호출은 esm-shared.ts 의 esmFetch (JWT + gateway) 가 담당.
 *
 * 보안 강제:
 *   - PII (buyerName / receiverName / receiverAddress / receiverPhone) 는 로그 금지.
 *     본 파일은 로깅 자체를 하지 않는다 (순수 변환).
 *   - 마켓 raw status ('PAID' 등) 는 normalizeEsmStatus 로 정규화 enum 변환.
 */

import { z } from 'npm:zod@3.23.8'
import type { MarketId } from '../schemas.ts'
import {
  MarketOrderSchema,
  normalizeIsoOffset,
  type MarketOrder,
  type MarketOrderStatus,
} from '../market-orders.ts'

// ─────────────────────────────────────────────
// ESM 주문 조회 응답 스키마
// ─────────────────────────────────────────────

const EsmOrderEntrySchema = z.object({
  orderNo: z.union([z.string(), z.number()]),
  buyerName: z.string().optional().default(''),
  receiverName: z.string().optional().default(''),
  receiverZipCode: z.string().optional().default(''),
  receiverAddress: z.string().optional().default(''),
  receiverPhone: z.string().optional().default(''),
  itemName: z.string().optional().default(''),
  orderQty: z.number().int().nonnegative().optional().default(1),
  orderPrice: z.number().int().nonnegative().optional().default(0),
  orderStatus: z.string().optional().default('PAID'),
  paidDate: z.string().optional(),
})

export const EsmOrderListResponseSchema = z.object({
  resultCode: z.string().optional(),
  resultMessage: z.string().optional(),
  data: z
    .object({
      orders: z.array(EsmOrderEntrySchema).optional().default([]),
    })
    .optional(),
})

export type EsmOrderListResponse = z.infer<typeof EsmOrderListResponseSchema>
type EsmOrderEntry = z.infer<typeof EsmOrderEntrySchema>

// ─────────────────────────────────────────────
// status 정규화
// ─────────────────────────────────────────────

export function normalizeEsmStatus(raw: string): MarketOrderStatus {
  switch (raw) {
    case 'PAID':
    case 'PAY_COMPLETE':
      return 'new_pay'
    case 'SHIPPED':
    case 'DISPATCHED':
      return 'dispatched'
    case 'DELIVERING':
      return 'delivering'
    case 'DELIVERED':
      return 'delivered'
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled'
    case 'RETURNED':
      return 'returned'
    default:
      return 'unknown'
  }
}

// ─────────────────────────────────────────────
// 응답 → MarketOrder[] 매핑 (순수)
// ─────────────────────────────────────────────

export function mapEsmOrders(
  items: EsmOrderEntry[],
  market: MarketId,
): MarketOrder[] {
  return items.map((item) => {
    const order: MarketOrder = {
      market,
      externalOrderId: String(item.orderNo),
      buyerName: item.buyerName.length > 0 ? item.buyerName : '미상',
      receiverName: item.receiverName.length > 0 ? item.receiverName : '미상',
      receiverAddress:
        item.receiverAddress.length > 0 ? item.receiverAddress : '주소 없음',
      receiverPhone:
        item.receiverPhone.length > 0 ? item.receiverPhone : '연락처 없음',
      productName: item.itemName.length > 0 ? item.itemName : '상품명 없음',
      quantity: item.orderQty > 0 ? item.orderQty : 1,
      orderAmount: item.orderPrice,
      status: normalizeEsmStatus(item.orderStatus),
      paidAt: normalizeIsoOffset(item.paidDate),
    }
    return MarketOrderSchema.parse(order)
  })
}
