/**
 * 마켓 주문 조회 타입 (Edge Function 측 단일 출처).
 *
 * 마스터:
 *   - apps/web/src/lib/schemas/market-orders.ts (프론트엔드 미러 — 동일 shape 유지)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - docs/spec/PRD.md §6.1 (주문 자동 수집)
 *
 * 본 파일은 Deno(npm:zod) 측 단일 출처다. orders-sync 의 adapter-shape.ts 는 본 파일을
 * 재export 한다 (중복 재선언 금지). MarketAdapter.fetchOrders 의 입출력 타입도 본 파일.
 *
 * 강제:
 *   - 어댑터가 반환한 PII (buyerName / receiverName / receiverAddress / receiverPhone) 는
 *     로그에 직접 출력 금지. logger maskRecord 가 키 이름 기반 마스킹.
 *   - 마켓 raw status (예: 11번가 '101', 쿠팡 'ACCEPT') 는 어댑터 내부에서 아래 정규화
 *     enum 으로 변환된다.
 */

import { z } from 'npm:zod@3.23.8'
import { IsoDateTimeOffsetSchema, MarketIdSchema, UuidSchema } from './schemas.ts'

// ─────────────────────────────────────────────
// MarketOrderStatus — 정규화 enum
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
// FetchOrdersInput
// ─────────────────────────────────────────────
export const FetchOrdersInputSchema = z.object({
  sellerId: UuidSchema,
  since: IsoDateTimeOffsetSchema.optional(),
  until: IsoDateTimeOffsetSchema.optional(),
  statuses: z.array(MarketOrderStatusSchema).optional(),
})
export type FetchOrdersInput = z.infer<typeof FetchOrdersInputSchema>

// ─────────────────────────────────────────────
// MarketOrder — fetchOrders 반환 항목 (PRD §6 컬럼 정합)
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
  /**
   * 주문 생성 시각 — 마켓 응답의 orderedAt. 마켓별 미제공 시 omit.
   * 쿠팡 v5: entry.orderedAt / 네이버: entry.orderDate 등.
   */
  orderedAt: IsoDateTimeOffsetSchema.optional(),
  /**
   * 쿠팡 vendor_item_id — 송장 제출 body 의 vendorItemId 재사용.
   * 쿠팡 외 마켓은 항상 omit.
   */
  vendorItemId: z.string().min(1).optional(),
  /**
   * 마켓별 발송처리 키 — 11번가 `dlvNo`(배송번호) 등 마켓 API 가 송장 제출 시 요구하는
   * 추가 식별자. 다른 마켓은 omit. PII 아님 (마켓 내부 식별자). (11st.md §4.4/§4.5)
   */
  extra: z.record(z.string()).optional(),
  market: MarketIdSchema,
})
export type MarketOrder = z.infer<typeof MarketOrderSchema>

// ─────────────────────────────────────────────
// SubmitTracking (v2 shipping) — 입력/결과
// ─────────────────────────────────────────────
export const TRACKING_CARRIER_CODES = ['LOGEN'] as const
export const TrackingCarrierCodeSchema = z.enum(TRACKING_CARRIER_CODES)
export type TrackingCarrierCode = z.infer<typeof TrackingCarrierCodeSchema>

export const SubmitTrackingInputSchema = z.object({
  externalOrderId: z.string().min(1),
  waybillNumber: z.string().min(1).max(40),
  carrierCode: TrackingCarrierCodeSchema,
  /**
   * 마켓 주문 ID — 쿠팡 v4 /orders/invoices body 의 orderId. shipmentBoxId 와 별개.
   * 다른 마켓은 omit (어댑터에서 무시).
   */
  orderId: z.string().min(1).optional(),
  /**
   * 쿠팡 vendor_item_id — v4 /orders/invoices body 의 vendorItemId 필수.
   */
  vendorItemId: z.string().min(1).optional(),
})
export type SubmitTrackingInput = z.infer<typeof SubmitTrackingInputSchema>

export const MarketSubmitTrackingResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    dispatchId: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    errorCode: z.string().min(1),
    errorMessage: z.string().min(1),
  }),
])
export type MarketSubmitTrackingResult = z.infer<
  typeof MarketSubmitTrackingResultSchema
>

/**
 * ISO 8601 + offset 정규화 헬퍼 — 마켓 raw 날짜 문자열을 표준 형식으로.
 * 마켓별 어댑터가 paidAt 매핑 시 공통 사용.
 */
export function normalizeIsoOffset(raw: string | undefined): string {
  if (!raw) return '1970-01-01T00:00:00+00:00'
  if (/[+-]\d{2}:\d{2}$/.test(raw)) return raw
  if (raw.endsWith('Z')) return raw.replace(/Z$/, '+00:00')
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '1970-01-01T00:00:00+00:00'
  return d.toISOString().replace(/Z$/, '+00:00')
}
