/**
 * orders-sync 자체 어댑터 시그니처 — PR4 `market-orders.ts` 와 1:1 정합.
 *
 * 마스터:
 *   - apps/web/src/lib/schemas/market-orders.ts (PR4, 단일 출처)
 *   - docs/spec/PRD-v2-shipping.md §2.1 (주문 자동 수집)
 *   - docs/spec/PRD-v2-shipping.md §4 (orders 테이블 스키마)
 *
 * 본 파일은 Vite/Node ESM ↔ Deno 호환성 문제로 PR4 의 zod 스키마를 직접 import 하지
 * 않고 미러로 재선언한다. 변경 시 PR4 의 `market-orders.ts` 와 동시 갱신.
 *
 * 강제:
 *   - MarketAdapter 5메서드 인터페이스는 건드리지 않는다 (cross-cutting/market-adapter.md §2.1).
 *   - fetchOrders 는 별개 OrderSyncAdapter 확장 — 어댑터 본체에 동적 부착.
 *   - 마켓 raw status (한글 '결제완료/배송대기') 는 어댑터 내부에서 정규화 enum 으로 변환됨.
 *     본 PR 의 orders-sync 는 정규화된 enum (`new_pay` 등) 만 다룬다.
 */

import { z } from 'npm:zod@3.23.8'
import {
  IsoDateTimeOffsetSchema,
  MarketIdSchema,
  UuidSchema,
} from '../../_shared/index.ts'

// ─────────────────────────────────────────────
// MarketOrderStatus — PR4 정규화 enum
// ─────────────────────────────────────────────
export const MarketOrderStatusSchema = z.enum([
  'new_pay',
  'dispatched',
  'delivering',
  'delivered',
  'cancelled',
  'returned',
  'unknown',
])
export type MarketOrderStatus = z.infer<typeof MarketOrderStatusSchema>

// ─────────────────────────────────────────────
// FetchOrdersInput — PR4 시그니처
// ─────────────────────────────────────────────
export const FetchOrdersInputSchema = z.object({
  sellerId: UuidSchema,
  since: IsoDateTimeOffsetSchema.optional(),
  until: IsoDateTimeOffsetSchema.optional(),
  statuses: z.array(MarketOrderStatusSchema).optional(),
})
export type FetchOrdersInput = z.infer<typeof FetchOrdersInputSchema>

// ─────────────────────────────────────────────
// MarketOrder — PR4 와 1:1 매핑 (PRD §4 컬럼 정합)
//
// 어댑터가 반환한 PII (buyerName / receiverName / receiverAddress / receiverPhone) 는
// 로그에 절대 직접 출력 금지. logger 의 maskRecord 가 키 이름 기반 마스킹.
// ─────────────────────────────────────────────
export const MarketOrderSchema = z.object({
  externalOrderId: z.string().min(1),
  buyerName: z.string().min(1),
  receiverName: z.string().min(1),
  receiverAddress: z.string().min(1),
  receiverPhone: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  orderAmount: z.number().int().nonnegative(),
  status: MarketOrderStatusSchema,
  paidAt: IsoDateTimeOffsetSchema,
  market: MarketIdSchema,
})
export type MarketOrder = z.infer<typeof MarketOrderSchema>

/**
 * 폴링 시 어댑터에 요청할 정규화 status 목록.
 *
 * PRD §2.1 "결제완료/배송대기 주문만 수집" — 어댑터 정규화 단계에서 두 raw 상태가
 * 모두 `new_pay` 로 매핑된다 (네이버 NEW_PAY_WAITING / 쿠팡 ACCEPT 등). 본 PR 은
 * `new_pay` 1종만 폴링 대상.
 *
 * (배송대기 별도 enum 필요 시 PR4 의 MarketOrderStatusSchema 에 추가 후 본 배열 갱신.)
 */
export const ORDER_SYNC_TARGET_STATUSES: ReadonlyArray<MarketOrderStatus> = [
  'new_pay',
]

/**
 * OrderSyncAdapter — v2 fetchOrders 확장.
 *
 * MarketAdapter 5메서드는 그대로 두고 별개 인터페이스로 분리. PR4 머지 시 본 인터페이스를
 * `_shared/market-adapter.ts` 의 정식 정의로 흡수.
 */
export interface OrderSyncAdapter {
  fetchOrders(input: FetchOrdersInput): Promise<MarketOrder[]>
}

/** runtime shape check — PR4 머지 전 안전망. */
export function hasFetchOrders(
  adapter: unknown,
): adapter is OrderSyncAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    typeof (adapter as { fetchOrders?: unknown }).fetchOrders === 'function'
  )
}
