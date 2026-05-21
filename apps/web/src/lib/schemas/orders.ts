import { z } from 'zod'
import { MarketIdSchema, UuidSchema, IsoDateTimeSchema } from './common'

/**
 * 주문 / 배송 (s7) 도메인 zod 스키마.
 *
 * 마스터:
 *  - docs/architecture/v1/features/orders.md (PR2 가 신설 예정)
 *  - user_flow-v2-shipping.md s7 (n47/n48/n49/n50)
 *  - PRD-v2-shipping.md §2.5
 *
 * 본 파일은 PR2 (orders zod 스키마 + RLS) 머지 시점에 백엔드(SQL) 와 합쳐서
 * Single Source 로 재정렬된다. 본 PR(v2-fe-orders) 은 프론트 화면 진입을 위한
 * 최소 형태로 선도입 — 인터페이스 변경 가능성 있음.
 *
 * Order 상태 머신 (PR 본문 명시):
 *   collected → logen_registered → waybill_printed → tracking_submitted
 *                ↑
 *              logen_failed (실패 분기, n50 수동처리 경로)
 *
 * 마켓 송장 제출 상태는 별도 컬럼으로 추적 — 운송장 출력 ≠ 마켓 송장 제출.
 */

// ─────────────────────────────────────────────
// ENUM
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

export const MARKET_DISPATCH_STATUSES = [
  'pending',
  'submitted',
  'failed',
] as const
export type MarketDispatchStatus = (typeof MARKET_DISPATCH_STATUSES)[number]
export const MarketDispatchStatusSchema = z.enum(MARKET_DISPATCH_STATUSES)

// ─────────────────────────────────────────────
// 주문 행
// ─────────────────────────────────────────────
export const OrderSummarySchema = z.object({
  id: UuidSchema,
  externalOrderId: z.string(),
  marketId: MarketIdSchema,
  productName: z.string(),
  buyerMaskedName: z.string(),
  shippingStatus: OrderShippingStatusSchema,
  marketDispatchStatus: MarketDispatchStatusSchema,
  waybillNumber: z.string().nullable(),
  orderedAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
})
export type OrderSummary = z.infer<typeof OrderSummarySchema>

// ─────────────────────────────────────────────
// 주문 상세
// ─────────────────────────────────────────────
export const OrderDetailSchema = z.object({
  order: z.object({
    id: UuidSchema,
    sellerId: UuidSchema,
    externalOrderId: z.string(),
    marketId: MarketIdSchema,
    productName: z.string(),
    productOption: z.string().nullable(),
    quantity: z.number().int().positive(),
    buyerMaskedName: z.string(),
    buyerMaskedPhone: z.string().nullable(),
    shippingAddressMasked: z.string(),
    shippingStatus: OrderShippingStatusSchema,
    marketDispatchStatus: MarketDispatchStatusSchema,
    waybillNumber: z.string().nullable(),
    logenErrorMessage: z.string().nullable(),
    orderedAt: IsoDateTimeSchema,
    collectedAt: IsoDateTimeSchema.nullable(),
    logenRegisteredAt: IsoDateTimeSchema.nullable(),
    waybillPrintedAt: IsoDateTimeSchema.nullable(),
    trackingSubmittedAt: IsoDateTimeSchema.nullable(),
    updatedAt: IsoDateTimeSchema,
  }),
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
  byMarket: z.array(
    z.object({
      marketId: MarketIdSchema,
      newOrdersCount: z.number().int().nonnegative(),
      pendingCount: z.number().int().nonnegative(),
    }),
  ),
})
export type OrdersSummary = z.infer<typeof OrdersSummarySchema>

// ─────────────────────────────────────────────
// 목록 필터 (URL search params 와 매핑)
// ─────────────────────────────────────────────
export const OrdersFilterSchema = z.object({
  marketId: MarketIdSchema.optional(),
  status: OrderShippingStatusSchema.optional(),
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
  q: z.string().trim().min(1).max(120).optional(),
  pageSize: z.number().int().min(1).max(100).default(50),
  cursor: IsoDateTimeSchema.optional(),
  cursorId: UuidSchema.optional(),
})
export type OrdersFilter = z.infer<typeof OrdersFilterSchema>

// ─────────────────────────────────────────────
// 수동처리 입력 (n50)
// ─────────────────────────────────────────────
export const ManualResolveWaybillSchema = z.object({
  orderId: UuidSchema,
  waybillNumber: z
    .string()
    .trim()
    .min(8, '운송장번호는 8자리 이상이어야 합니다')
    .max(20, '운송장번호는 20자리를 초과할 수 없습니다')
    .regex(/^[0-9A-Za-z-]+$/, '운송장번호는 숫자·영문·하이픈만 사용할 수 있습니다'),
  note: z.string().max(500).optional(),
})
export type ManualResolveWaybillInput = z.infer<typeof ManualResolveWaybillSchema>
