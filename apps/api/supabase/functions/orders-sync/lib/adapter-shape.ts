/**
 * orders-sync 자체 어댑터 시그니처 (PR4 가 정식 정의 예정).
 *
 * 마스터 (예정):
 *   - docs/architecture/v1/features/v2-shipping.md §3.2
 *   - PRD-v2-shipping.md §2.1
 *
 * 본 PR (PR5) 는 PR4 머지 전 진입이므로 fetchOrders 시그니처를 자체 선언한다.
 * PR4 머지 시 본 파일을 _shared/market-adapter.ts 의 OrderSyncAdapter 로 교체.
 *
 * 강제:
 *   - MarketAdapter 5메서드 인터페이스는 건드리지 않는다 (cross-cutting/market-adapter.md §2.1).
 *   - fetchOrders 는 별개 OrderSyncAdapter 확장 — adapter 본체에 동적으로 부착될
 *     것으로 가정. 본 PR 의 mock 어댑터도 동일 모양을 따른다.
 *
 * 시그니처:
 *   fetchOrders(input: FetchOrdersInput): Promise<MarketOrder[]>
 *   - input.accessToken (또는 credential payload) 는 mocking 단순화를 위해
 *     opaque payload 로 전달.
 *   - since: ISO datetime — 윈도우 시작.
 *   - status: 폴링 대상 상태 (default '결제완료').
 */

import { z } from 'npm:zod@3.23.8'
import {
  IsoDateTimeOffsetSchema,
  MarketIdSchema,
} from '../../_shared/index.ts'

export const FetchOrdersInputSchema = z.object({
  /** credential payload (oauth.accessToken | hmac payload | esm_jwt payload | api_key) */
  credentialPayload: z.record(z.string(), z.unknown()),
  /** ISO datetime, 폴링 윈도우 시작 (보통 now - 24h). */
  since: IsoDateTimeOffsetSchema,
  /** 결제완료 등 폴링 대상 상태. */
  status: z.string().min(1).default('결제완료'),
})
export type FetchOrdersInput = z.infer<typeof FetchOrdersInputSchema>

export const MarketOrderSchema = z.object({
  marketId: MarketIdSchema,
  /** 마켓 측 주문 식별자 (예: 쿠팡 orderId, 네이버 productOrderId). */
  externalOrderId: z.string().min(1),
  /** 마켓 측 주문 상태 raw 값 (예: '결제완료'). */
  status: z.string().min(1),
  /** 주문 시각 (마켓 응답 그대로). */
  orderedAt: IsoDateTimeOffsetSchema,
  /** 마켓 raw payload — orders.payload jsonb 컬럼에 적재. */
  payload: z.record(z.string(), z.unknown()),
})
export type MarketOrder = z.infer<typeof MarketOrderSchema>

/**
 * OrderSyncAdapter — v2 fetchOrders 확장.
 *
 * MarketAdapter 5메서드를 건드리지 않고 별개 인터페이스로 분리. 동적 부착 형태로,
 * `(adapter as Partial<OrderSyncAdapter>).fetchOrders` 존재 여부를 호출측이 확인.
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
