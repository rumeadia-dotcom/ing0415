/**
 * shipping-dispatch-job / shipping-dispatch-market-worker 공유 zod 스키마.
 *
 * 마스터 (의존 — 본 PR 범위 외 정의):
 *   - docs/spec/PRD-v2-shipping.md §2.4 (스펙 문서는 PR 시점에 별도 작성 예정)
 *   - docs/spec/user_flow-v2-shipping.md s8 n53/n54/n55/n56
 *   - PR2: shipping_jobs / shipping_job_results / orders 마이그레이션
 *
 * 본 PR 가정:
 *   - shipping_jobs(id, seller_id, status, created_at, started_at, completed_at, correlation_id)
 *   - shipping_job_results(id, job_id, order_id, market_id, market_account_id,
 *       result_status, error_code, error_message, waybill_number, carrier_code,
 *       attempt_count, last_attempted_at)
 *   - orders(id, seller_id, market_id, market_account_id, external_order_id, status,
 *       waybill_number, carrier_code)
 *   - orders.status ENUM: 'waybill_printed' | 'tracking_submitted' | 'dispatch_failed' | ...
 *
 * 스펙 문서 (PRD-v2-shipping.md) 가 작성되면 본 가정과 정합 확인 + zod 미러 갱신.
 */

import { z } from 'npm:zod@3.23.8'
import { MarketIdSchema, UuidSchema } from '../../_shared/index.ts'

// ─────────────────────────────────────────────
// shipping_jobs.status ENUM (registration_jobs 와 동등 패턴)
// ─────────────────────────────────────────────
export const SHIPPING_JOB_STATUSES = [
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
  'cancelled',
] as const
export const ShippingJobStatusSchema = z.enum(SHIPPING_JOB_STATUSES)
export type ShippingJobStatus = z.infer<typeof ShippingJobStatusSchema>

// ─────────────────────────────────────────────
// shipping_job_results.result_status ENUM
// ─────────────────────────────────────────────
export const SHIPPING_RESULT_STATUSES = [
  'pending',
  'in_flight',
  'success',
  'failed',
  'failed_final',
] as const
export const ShippingResultStatusSchema = z.enum(SHIPPING_RESULT_STATUSES)
export type ShippingResultStatus = z.infer<typeof ShippingResultStatusSchema>

// ─────────────────────────────────────────────
// shipping_job_results.error_code (재시도 정책)
// ─────────────────────────────────────────────
export const SHIPPING_ERROR_CODES = [
  'rate_limit',
  'timeout',
  'market_5xx',
  'oauth_expired',
  'oauth_revoked',
  'validation',
  'duplicate', // 동일 송장 중복 제출
  'unknown',
] as const
export const ShippingErrorCodeSchema = z.enum(SHIPPING_ERROR_CODES)
export type ShippingErrorCode = z.infer<typeof ShippingErrorCodeSchema>

// ─────────────────────────────────────────────
// dispatch-job request
// ─────────────────────────────────────────────
export const DispatchJobRequestSchema = z.object({
  sellerId: UuidSchema,
  orderIds: z.array(UuidSchema).min(1).max(500).optional(),
})
export type DispatchJobRequest = z.infer<typeof DispatchJobRequestSchema>

// ─────────────────────────────────────────────
// market-worker request (service_role 내부 호출)
// ─────────────────────────────────────────────
export const DispatchMarketWorkerRequestSchema = z.object({
  jobId: UuidSchema,
  marketId: MarketIdSchema,
  orderIds: z.array(UuidSchema).min(1).max(500),
  correlationId: z.string().min(8),
})
export type DispatchMarketWorkerRequest = z.infer<
  typeof DispatchMarketWorkerRequestSchema
>

// ─────────────────────────────────────────────
// 주문 row (db ← service)
// ─────────────────────────────────────────────
export interface OrderRow {
  id: string
  seller_id: string
  market_id: string
  market_account_id: string
  external_order_id: string
  status: string
  waybill_number: string | null
  carrier_code: string | null
}

// ─────────────────────────────────────────────
// dispatch-job response
// ─────────────────────────────────────────────
export const PerMarketSummarySchema = z.object({
  marketId: MarketIdSchema,
  total: z.number().int().nonnegative(),
  invoked: z.boolean(),
})
export type PerMarketSummary = z.infer<typeof PerMarketSummarySchema>

export const DispatchJobResponseSchema = z.object({
  jobId: UuidSchema,
  status: ShippingJobStatusSchema,
  perMarket: z.array(PerMarketSummarySchema),
})
export type DispatchJobResponse = z.infer<typeof DispatchJobResponseSchema>
