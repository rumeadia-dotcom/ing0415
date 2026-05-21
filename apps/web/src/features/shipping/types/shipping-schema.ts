import { z } from 'zod'
import { MarketIdSchema, IsoDateTimeSchema } from '@/lib/schemas/common'

/**
 * shipping (s8) 도메인 zod 스키마 — feature-local 위치.
 *
 * 임시 위치: PR2 (shipping zod 스키마 + RLS) 가 머지되면 본 파일은
 * `apps/web/src/lib/schemas/shipping.ts` 로 이관되고 본 파일은 re-export shim 으로 축약된다.
 *
 * 근거:
 *  - user_flow-v2-shipping.md s8 (n52~n57)
 *  - PRD-v2-shipping.md §2.3 (운송장 출력 → 송장 일괄 제출), §2.4 (이력)
 */

// ─────────────────────────────────────────────
// Order shipping status (운송장 / 송장 라이프사이클)
// ─────────────────────────────────────────────
export const ORDER_SHIPPING_STATUSES = [
  'logen_registered',
  'waybill_printed',
  'dispatched',
  'failed',
] as const
export type OrderShippingStatus = (typeof ORDER_SHIPPING_STATUSES)[number]
export const OrderShippingStatusSchema = z.enum(ORDER_SHIPPING_STATUSES)

// ─────────────────────────────────────────────
// Shipping dispatch job (송장 일괄 제출 잡)
// ─────────────────────────────────────────────
export const SHIPPING_JOB_STATUSES = [
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
  'cancelled',
] as const
export type ShippingJobStatus = (typeof SHIPPING_JOB_STATUSES)[number]
export const ShippingJobStatusSchema = z.enum(SHIPPING_JOB_STATUSES)

export const SHIPPING_MARKET_RESULT_STATUSES = [
  'pending',
  'in_flight',
  'success',
  'failed',
  'failed_final',
] as const
export type ShippingMarketResultStatus = (typeof SHIPPING_MARKET_RESULT_STATUSES)[number]
export const ShippingMarketResultStatusSchema = z.enum(SHIPPING_MARKET_RESULT_STATUSES)

// ─────────────────────────────────────────────
// Print list row (n52) — status=logen_registered orders
// ─────────────────────────────────────────────
export const ShippingPrintOrderSchema = z.object({
  orderId: z.string().uuid(),
  marketId: MarketIdSchema,
  marketOrderNo: z.string().min(1),
  productName: z.string().min(1),
  buyerName: z.string().min(1),
  waybillNumber: z.string().min(1),
  shippingStatus: OrderShippingStatusSchema,
  registeredAt: IsoDateTimeSchema,
})
export type ShippingPrintOrder = z.infer<typeof ShippingPrintOrderSchema>

// ─────────────────────────────────────────────
// Dispatch preview (n53) — status=waybill_printed orders, market-grouped
// ─────────────────────────────────────────────
export const ShippingDispatchMarketGroupSchema = z.object({
  marketId: MarketIdSchema,
  orderCount: z.number().int().nonnegative(),
})
export type ShippingDispatchMarketGroup = z.infer<typeof ShippingDispatchMarketGroupSchema>

export const ShippingDispatchPreviewSchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  printedOrders: z.number().int().nonnegative(),
  unprintedOrders: z.number().int().nonnegative(),
  marketGroups: z.array(ShippingDispatchMarketGroupSchema),
})
export type ShippingDispatchPreview = z.infer<typeof ShippingDispatchPreviewSchema>

// ─────────────────────────────────────────────
// Shipping job + market_results (n54 / n55 / n57)
// ─────────────────────────────────────────────
export const ShippingJobMarketResultSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  marketId: MarketIdSchema,
  marketAccountId: z.string().uuid(),
  status: ShippingMarketResultStatusSchema,
  totalOrders: z.number().int().nonnegative(),
  successOrders: z.number().int().nonnegative(),
  failedOrders: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(0).max(3),
  lastAttemptedAt: z.string().datetime().nullable(),
})
export type ShippingJobMarketResult = z.infer<typeof ShippingJobMarketResultSchema>

export const ShippingJobSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  status: ShippingJobStatusSchema,
  totalOrders: z.number().int().nonnegative(),
  retryCount: z.number().int().min(0).max(5),
  errorSummary: z.string().nullable(),
  parentJobId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
})
export type ShippingJob = z.infer<typeof ShippingJobSchema>

// ─────────────────────────────────────────────
// Job list row (n57)
// ─────────────────────────────────────────────
export const ShippingJobListItemSchema = ShippingJobSchema.extend({
  successCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  marketIds: z.array(MarketIdSchema),
})
export type ShippingJobListItem = z.infer<typeof ShippingJobListItemSchema>

// ─────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────

/** [출력 완료] — 운송장 출력 후 상태를 waybill_printed 로 전환. */
export const MarkWaybillPrintedRequestSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(500),
})
export type MarkWaybillPrintedRequest = z.infer<typeof MarkWaybillPrintedRequestSchema>

export const MarkWaybillPrintedResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
})
export type MarkWaybillPrintedResponse = z.infer<typeof MarkWaybillPrintedResponseSchema>

/** [제출 시작] — shipping-dispatch-job invoke (PR7). */
export const ShippingDispatchStartRequestSchema = z.object({
  marketIds: z.array(MarketIdSchema).min(1).max(5).optional(),
  parentJobId: z.string().uuid().optional(),
})
export type ShippingDispatchStartRequest = z.infer<typeof ShippingDispatchStartRequestSchema>

export const ShippingDispatchStartResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('pending'),
  totalOrders: z.number().int().nonnegative(),
})
export type ShippingDispatchStartResponse = z.infer<typeof ShippingDispatchStartResponseSchema>

/** [재시도] — 부분 재시도 (n56). */
export const ShippingDispatchRetryRequestSchema = z.object({
  jobId: z.string().uuid(),
  marketResultIds: z.array(z.string().uuid()).optional(),
})
export type ShippingDispatchRetryRequest = z.infer<typeof ShippingDispatchRetryRequestSchema>

export const ShippingDispatchRetryResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.literal('running'),
  retried: z.array(
    z.object({
      marketResultId: z.string().uuid(),
      marketId: MarketIdSchema,
    }),
  ),
})
export type ShippingDispatchRetryResponse = z.infer<typeof ShippingDispatchRetryResponseSchema>
