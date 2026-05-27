/**
 * orders-sync 어댑터 시그니처 — `_shared/market-orders.ts` 단일 출처 재export.
 *
 * 마스터:
 *   - apps/api/supabase/functions/_shared/market-orders.ts (Deno 단일 출처)
 *   - apps/web/src/lib/schemas/market-orders.ts (프론트엔드 미러)
 *   - docs/spec/PRD.md §6.1 (주문 자동 수집)
 *
 * 강제:
 *   - 주문 zod 스키마는 `_shared/market-orders.ts` 한 곳에서만 정의. 본 파일은 재export +
 *     orders-sync 고유 상수/인터페이스만 둔다 (중복 재선언 금지).
 *   - 마켓 raw status (한글 '결제완료/배송대기' / 코드 '101' 등) 는 어댑터 내부에서 정규화
 *     enum (`new_pay` 등) 으로 변환됨. orders-sync 는 정규화 enum 만 다룬다.
 */

export {
  MarketOrderStatusSchema,
  FetchOrdersInputSchema,
  MarketOrderSchema,
  type MarketOrderStatus,
  type FetchOrdersInput,
  type MarketOrder,
} from '../../_shared/index.ts'

import type { FetchOrdersInput, MarketOrder, MarketOrderStatus } from '../../_shared/index.ts'

/**
 * 폴링 시 어댑터에 요청할 정규화 status 목록.
 *
 * PRD §6.1 "결제완료/배송대기 주문만 수집" — 어댑터 정규화 단계에서 raw 상태가 `new_pay`
 * 로 매핑된다 (네이버 NEW_PAY_WAITING / 쿠팡 ACCEPT / 11번가 '101' 등).
 */
export const ORDER_SYNC_TARGET_STATUSES: readonly MarketOrderStatus[] = [
  'new_pay',
]

/**
 * OrderSyncAdapter — fetchOrders 확장.
 *
 * MarketAdapter 의 optional `fetchOrders?` 가 정식 정의. 본 인터페이스는 orders-sync 가
 * 런타임 shape 체크 후 좁히는 용도.
 */
export interface OrderSyncAdapter {
  fetchOrders(input: FetchOrdersInput): Promise<MarketOrder[]>
}

/** runtime shape check — fetchOrders 미구현 마켓 스킵 안전망. */
export function hasFetchOrders(adapter: unknown): adapter is OrderSyncAdapter {
  return (
    typeof adapter === 'object' &&
    adapter !== null &&
    typeof (adapter as { fetchOrders?: unknown }).fetchOrders === 'function'
  )
}
