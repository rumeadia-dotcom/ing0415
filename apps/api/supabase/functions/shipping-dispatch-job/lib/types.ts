/**
 * shipping-dispatch-job / shipping-dispatch-market-worker 공유 zod 스키마.
 *
 * 마스터 (ground truth):
 *   - docs/spec/PRD.md §6.4 (마켓 송장 일괄 제출 플로우)
 *   - docs/spec/PRD.md §8 (데이터 모델)
 *
 * PRD §4 정합 — shipping_jobs:
 *   - id, seller_id, status, order_count, success_count, failed_count,
 *     created_at, completed_at
 *   - status ENUM 5값: pending | running | partial | succeeded | failed
 *     (PRD §4 에 'cancelled' 없음 — 본 PR 도 5값 유지.)
 *   - 본 PR 이 order_count = preflight orders.length 으로 INSERT 시점에 채움.
 *     success_count / failed_count 는 마켓 워커가 row 갱신 시점에 누적 UPDATE.
 *
 * PRD §4 정합 — shipping_job_results:
 *   - id, job_id, order_id, market_id, status, error_code, error_message
 *   - 컬럼명: PRD §4 = `status` (본 PR 도 `status` 로 통일. result_status 아님).
 *   - PRD §4 ENUM = ('success' | 'failed') 2값.
 *     본 PR 워커는 재시도 / 진행 표시가 필요하므로 ENUM 을 5값
 *     (pending | in_flight | success | failed | failed_final) 으로 확장 사용.
 *     **PR2 마이그레이션이 PRD §4 의 2값에서 본 5값으로 확장 정의 필요.**
 *     (확장 사유: registration_jobs / registration_job_market_results 와 동등한
 *      재시도·격리 표현. PR2 머지 전 PRD §4 갱신 또는 별도 cross-cutting 문서로 정합.)
 *
 * PRD §4 정합 — orders.status ENUM 6값:
 *   - collected | logen_registered | logen_failed |
 *     waybill_printed | tracking_submitted | dispatch_failed
 *   - 본 워커가 전이하는 경로:
 *       waybill_printed → tracking_submitted (success)
 *       waybill_printed → dispatch_failed   (final 실패)
 */

import { z } from 'npm:zod@3.23.8'
import { MarketIdSchema, UuidSchema } from '../../_shared/index.ts'

// ─────────────────────────────────────────────
// shipping_jobs.status ENUM — PRD §4 5값.
// ─────────────────────────────────────────────
export const SHIPPING_JOB_STATUSES = [
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
] as const
export const ShippingJobStatusSchema = z.enum(SHIPPING_JOB_STATUSES)
export type ShippingJobStatus = z.infer<typeof ShippingJobStatusSchema>

// ─────────────────────────────────────────────
// shipping_job_results.status ENUM.
//
// PRD §4 명세 = 2값 ('success' | 'failed'). 본 PR 은 워커의 재시도·격리
// 표현을 위해 5값으로 확장 — PR2 마이그레이션이 같은 5값으로 정의해야 함.
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
