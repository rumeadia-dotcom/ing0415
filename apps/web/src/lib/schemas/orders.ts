import { z } from 'zod'
import { MarketIdSchema, UuidSchema, IsoDateTimeSchema } from './common'

/**
 * v2 주문 도메인 zod 스키마.
 *
 * 마스터:
 *  - docs/spec/PRD.md §6.1 (주문 자동 수집 + 상태 ENUM)
 *  - docs/spec/PRD.md §8 (orders DDL)
 *
 * 마이그레이션 동기화 대상: 20260521000001_orders.sql
 */

// ─────────────────────────────────────────────
// ENUM (PRD-v2 §2.1 / §4 order_status)
// ─────────────────────────────────────────────
export const ORDER_STATUSES = [
  'collected',
  'logen_registered',
  'logen_failed',
  'waybill_printed',
  'tracking_submitted',
  'dispatch_failed',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const OrderStatusEnum = z.enum(ORDER_STATUSES)

// ─────────────────────────────────────────────
// Order (DB row 표현 — Edge Function 응답 직후 parse)
// ─────────────────────────────────────────────
export const OrderSchema = z.object({
  id: UuidSchema,
  sellerId: UuidSchema,
  marketId: MarketIdSchema,
  externalOrderId: z.string().min(1).max(100),

  buyerName: z.string().nullable(),
  receiverName: z.string().min(1).max(100),
  receiverAddress: z.string().min(1).max(500),
  receiverPhone: z.string().min(1).max(30),

  productName: z.string().min(1).max(500),
  quantity: z.number().int().min(1),
  orderAmount: z.number().int().min(0),

  status: OrderStatusEnum,

  logenOrderId: z.string().nullable(),
  waybillNumber: z.string().nullable(),
  carrierCode: z.string().default('LOGEN'),

  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(0).max(5),

  collectedAt: IsoDateTimeSchema,
  logenRegisteredAt: IsoDateTimeSchema.nullable(),
  waybillPrintedAt: IsoDateTimeSchema.nullable(),
  dispatchedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
})
export type Order = z.infer<typeof OrderSchema>

// ═════════════════════════════════════════════
// 목록 필터·수동 송장·요약 (PRD-v2 §2.5 / §2.2 — PR8 keyset cursor 채택)
//   - 페이징은 keyset cursor (offset 은 대용량 OFFSET 성능 문제로 폐기).
//   - carrierCode 는 RPC 가 LOGEN 고정 — FE 에서 강제 입력 받지 않음.
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
// 배송 진행 상태 — 타임라인 UI 5단계
//   ko.orders.timeline 에 dispatch_failed 라벨이 추가돼 OrderStatusEnum (6개) 와 1:1 lookup 가능.
//   타임라인 컴포넌트는 5단계 진행만 그리지만 라벨 lookup 은 OrderStatusEnum 전 범위.
// ─────────────────────────────────────────────
export const ORDER_SHIPPING_STATUSES = [
  'collected',
  'logen_registered',
  'logen_failed',
  'waybill_printed',
  'tracking_submitted',
] as const
export type OrderShippingStatus = (typeof ORDER_SHIPPING_STATUSES)[number]
export const OrderShippingStatusSchema = z.enum(ORDER_SHIPPING_STATUSES)

// ─────────────────────────────────────────────
// 마켓 송장 제출 상태 (marketDispatchStatus)
//   ko.orders.dispatch 키와 1:1
// ─────────────────────────────────────────────
export const MARKET_DISPATCH_STATUSES = [
  'pending',
  'submitted',
  'failed',
] as const
export type MarketDispatchStatus = (typeof MARKET_DISPATCH_STATUSES)[number]
export const MarketDispatchStatusSchema = z.enum(MARKET_DISPATCH_STATUSES)

// ─────────────────────────────────────────────
// 목록 행 표현 (list_orders RPC 응답 매핑 — camelCase)
//   orders.api.ts 의 mapOrderRow 가 채우는 필드.
// ─────────────────────────────────────────────
export const OrderSummarySchema = z.object({
  id: UuidSchema,
  externalOrderId: z.string().min(1).max(100),
  marketId: MarketIdSchema,
  productName: z.string().min(1).max(500),
  buyerMaskedName: z.string().min(1).max(100),
  shippingStatus: OrderShippingStatusSchema,
  marketDispatchStatus: MarketDispatchStatusSchema,
  waybillNumber: z.string().nullable(),
  orderedAt: z.string(),
  updatedAt: z.string(),
})
export type OrderSummary = z.infer<typeof OrderSummarySchema>

// ─────────────────────────────────────────────
// 상세 (get_order RPC) — orders_with_dispatch_summary view 기준 단일 jsonb
//   { order: { ...camelCase fields } } 형태
// ─────────────────────────────────────────────
export const OrderDetailOrderSchema = z.object({
  id: UuidSchema,
  sellerId: UuidSchema,
  externalOrderId: z.string().min(1).max(100),
  marketId: MarketIdSchema,
  productName: z.string().min(1).max(500),
  productOption: z.string().nullable().optional(),
  quantity: z.number().int().min(1),
  buyerMaskedName: z.string().min(1).max(100),
  buyerMaskedPhone: z.string().nullable().optional(),
  shippingAddressMasked: z.string().min(1).max(500),
  shippingStatus: OrderShippingStatusSchema,
  marketDispatchStatus: MarketDispatchStatusSchema,
  waybillNumber: z.string().nullable(),
  logenErrorMessage: z.string().nullable().optional(),
  orderedAt: z.string(),
  collectedAt: z.string(),
  logenRegisteredAt: z.string().nullable(),
  waybillPrintedAt: z.string().nullable(),
  trackingSubmittedAt: z.string().nullable(),
  updatedAt: z.string(),
})
export const OrderDetailSchema = z.object({
  order: OrderDetailOrderSchema,
})
export type OrderDetail = z.infer<typeof OrderDetailSchema>

// ─────────────────────────────────────────────
// 대시보드 요약 (orders_with_dispatch_summary view)
// ─────────────────────────────────────────────
export const OrdersSummarySchema = z.object({
  newOrdersCount: z.number().int().nonnegative(),
  logenRegisteredCount: z.number().int().nonnegative(),
  waybillPendingCount: z.number().int().nonnegative(),
  dispatchSubmittedCount: z.number().int().nonnegative(),
  byMarket: z
    .array(
      z.object({
        marketId: MarketIdSchema,
        newOrdersCount: z.number().int().nonnegative(),
        pendingCount: z.number().int().nonnegative(),
      }),
    )
    .default([]),
})
export type OrdersSummary = z.infer<typeof OrdersSummarySchema>

// ─────────────────────────────────────────────
// 목록 필터 (keyset cursor 기반 — PR8 채택, offset 페이지네이션은 폐기)
//   PRD-v2 §2.5 — 마켓 / 상태 / 검색 / 기간 + keyset cursor (ordered_at + id tiebreaker).
// ─────────────────────────────────────────────
export const OrdersFilterSchema = z
  .object({
    marketId: MarketIdSchema.optional(),
    status: OrderShippingStatusSchema.optional(),
    /** collected_at 시작 (ISO). */
    from: z.string().optional(),
    /** collected_at 종료 (ISO). */
    to: z.string().optional(),
    /** 키워드 (상품명 / 수취인명) — server-side LIKE. */
    q: z.string().max(100).optional(),
    /** 페이지 크기 (1~100). */
    pageSize: z.number().int().min(1).max(100).default(50),
    /** keyset cursor — 마지막 페이지의 ordered_at. */
    cursor: z.string().optional(),
    /** keyset cursor — 마지막 페이지의 id (tiebreaker). */
    cursorId: z.string().optional(),
  })
  .refine(
    (d) => !d.from || !d.to || new Date(d.from) <= new Date(d.to),
    {
      message: 'from 은 to 이전이어야 합니다',
      path: ['to'],
    },
  )
export type OrdersFilter = z.infer<typeof OrdersFilterSchema>

// ─────────────────────────────────────────────
// 수동 송장 보정 (PR8 dialog → manual_resolve_waybill RPC)
//   PRD-v2 §2.2 "최종 실패 시 수동 처리 다이얼로그 유도".
//   carrierCode 는 DB (manual_resolve_waybill RPC / orders.carrier_code default) 가 LOGEN 으로 보정 —
//   FE 는 강제 입력 받지 않는다. v2 다중 택배사 진입 시 DB 단에서 결정.
// ─────────────────────────────────────────────
export const ManualResolveWaybillSchema = z.object({
  orderId: UuidSchema,
  waybillNumber: z
    .string()
    .min(8, '운송장번호는 8자리 이상이어야 합니다')
    .max(50, '운송장번호가 너무 깁니다'),
  note: z.string().max(500).optional(),
})
export type ManualResolveWaybillInput = z.infer<
  typeof ManualResolveWaybillSchema
>
