import { z } from 'zod'
import { MarketIdSchema, UuidSchema, IsoDateTimeSchema } from './common'

/**
 * v2 송장 일괄 제출 (shipping) 도메인 zod 스키마.
 *
 * 마스터:
 *  - docs/spec/PRD-v2-shipping.md §2.4 (마켓 송장 일괄 제출)
 *  - docs/spec/PRD-v2-shipping.md §4 (shipping_jobs / shipping_job_results DDL)
 *
 * 마이그레이션 동기화 대상: 20260521000002_shipping_jobs.sql
 */

// ─────────────────────────────────────────────
// ENUM
// ─────────────────────────────────────────────
export const SHIPPING_JOB_STATUSES = [
  'pending',
  'running',
  'partial',
  'succeeded',
  'failed',
] as const
export type ShippingJobStatus = (typeof SHIPPING_JOB_STATUSES)[number]

export const ShippingJobStatusEnum = z.enum(SHIPPING_JOB_STATUSES)

export const SHIPPING_MARKET_STATUSES = ['success', 'failed'] as const
export type ShippingMarketStatus = (typeof SHIPPING_MARKET_STATUSES)[number]

export const ShippingMarketStatusEnum = z.enum(SHIPPING_MARKET_STATUSES)

// ─────────────────────────────────────────────
// ShippingJob (잡 단위)
// ─────────────────────────────────────────────
export const ShippingJobSchema = z
  .object({
    id: UuidSchema,
    sellerId: UuidSchema,
    status: ShippingJobStatusEnum,
    orderCount: z.number().int().min(0),
    successCount: z.number().int().min(0),
    failedCount: z.number().int().min(0),
    errorSummary: z.string().nullable(),
    createdAt: IsoDateTimeSchema,
    startedAt: IsoDateTimeSchema.nullable(),
    completedAt: IsoDateTimeSchema.nullable(),
  })
  .refine((d) => d.successCount + d.failedCount <= d.orderCount, {
    message: 'success + failed 는 orderCount 를 초과할 수 없습니다',
    path: ['failedCount'],
  })
export type ShippingJob = z.infer<typeof ShippingJobSchema>

// ─────────────────────────────────────────────
// ShippingJobResult (잡 안의 주문×마켓 1건)
// ─────────────────────────────────────────────
export const ShippingJobResultSchema = z.object({
  id: UuidSchema,
  jobId: UuidSchema,
  orderId: UuidSchema,
  marketId: MarketIdSchema,
  status: ShippingMarketStatusEnum,
  externalDispatchId: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(1).max(5),
  createdAt: IsoDateTimeSchema,
})
export type ShippingJobResult = z.infer<typeof ShippingJobResultSchema>

// ─────────────────────────────────────────────
// 미리보기 (딸깍 직전 마켓별 건수 확인) — PRD-v2 §2.4 "처리 플로우"
// ─────────────────────────────────────────────
export const ShippingDispatchPreviewMarketRowSchema = z.object({
  marketId: MarketIdSchema,
  orderCount: z.number().int().min(0),
})

export const ShippingDispatchPreviewSchema = z.object({
  /** 송장 출력 완료(waybill_printed) 상태의 주문 합계. */
  totalOrders: z.number().int().min(0),
  /** 마켓별 분포 — MarketId 누락 마켓은 0 또는 미포함. */
  markets: z.array(ShippingDispatchPreviewMarketRowSchema),
})
export type ShippingDispatchPreview = z.infer<
  typeof ShippingDispatchPreviewSchema
>

// ─────────────────────────────────────────────
// 시작 입력 (1회 클릭) — "송장 일괄 제출"
//   대상 주문 ID 를 명시적으로 전달해 race condition 방지.
// ─────────────────────────────────────────────
export const ShippingDispatchStartInputSchema = z.object({
  orderIds: z
    .array(UuidSchema)
    .min(1, '제출할 주문을 1건 이상 선택해주세요')
    .max(500, '한 번에 최대 500건까지 처리 가능합니다'),
  /** 출력 후 자동 제출 옵션 트래픽 추적 (PRD-v2 §6 OQ-V2-05). */
  triggeredByAutoSubmit: z.boolean().default(false),
})
export type ShippingDispatchStartInput = z.infer<
  typeof ShippingDispatchStartInputSchema
>

// ─────────────────────────────────────────────
// 재시도 입력 — PRD-v2 §2.4 "마켓별 오류 + 재시도 버튼"
// ─────────────────────────────────────────────
export const ShippingDispatchRetryInputSchema = z
  .object({
    /** 재시도 대상 잡 ID. */
    jobId: UuidSchema,
    /** 잡 안에서 실패한 주문만 골라 재시도. 비우면 잡의 모든 failed 결과 재시도. */
    orderIds: z.array(UuidSchema).max(500).default([]),
  })
  .refine((d) => d.orderIds.length <= 500, {
    message: '한 번에 최대 500건까지 재시도 가능합니다',
    path: ['orderIds'],
  })
export type ShippingDispatchRetryInput = z.infer<
  typeof ShippingDispatchRetryInputSchema
>
