import { z } from 'zod'
import { MarketIdSchema, UuidSchema, IsoDateTimeSchema } from './common'

/**
 * v2 주문 도메인 zod 스키마.
 *
 * 마스터:
 *  - docs/spec/PRD-v2-shipping.md §2.1 (주문 자동 수집 + 상태 ENUM)
 *  - docs/spec/PRD-v2-shipping.md §4 (orders DDL)
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

// ─────────────────────────────────────────────
// 목록 필터 (PRD-v2 §2.5 — 마켓별 / 상태별 / 검색 / 기간)
// ─────────────────────────────────────────────
export const OrderListFilterSchema = z
  .object({
    marketId: MarketIdSchema.optional(),
    status: OrderStatusEnum.optional(),
    /** ISO 8601 (offset 없이도 허용). collected_at 기준. */
    dateFrom: IsoDateTimeSchema.optional(),
    dateTo: IsoDateTimeSchema.optional(),
    /** 키워드 (상품명 / 수취인명) — server-side LIKE. 빈 문자열은 무시. */
    keyword: z.string().max(100).optional(),
    /** 페이지네이션 (1~100). */
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
  })
  .refine(
    (d) =>
      !d.dateFrom || !d.dateTo || new Date(d.dateFrom) <= new Date(d.dateTo),
    {
      message: 'dateFrom 은 dateTo 이전이어야 합니다',
      path: ['dateTo'],
    },
  )
export type OrderListFilter = z.infer<typeof OrderListFilterSchema>

// ─────────────────────────────────────────────
// 수동 송장 입력 (logen_failed → 수동 보정 다이얼로그)
//   PRD-v2 §2.2 "최종 실패 시 수동 처리 다이얼로그 유도"
// ─────────────────────────────────────────────
export const ManualWaybillResolveInputSchema = z.object({
  orderId: UuidSchema,
  /** 셀러가 로젠 콘솔에서 직접 채번한 슬립번호. */
  waybillNumber: z.string().min(1).max(50),
  /** 운반사 (현재 LOGEN 만 지원하나 미래 대비 default LOGEN). */
  carrierCode: z.string().min(1).max(20).default('LOGEN'),
  /** 셀러 직접 입력 사유 (옵션) — audit 용. */
  note: z.string().max(500).optional(),
})
export type ManualWaybillResolveInput = z.infer<
  typeof ManualWaybillResolveInputSchema
>
