import { z } from 'zod'
import { MarketIdSchema } from './common'
import {
  MarketResultStatusSchema,
  RegistrationJobStatusSchema,
} from './registration'

/**
 * 이력 도메인 zod 스키마.
 * 마스터: docs/architecture/v1/features/history.md §3.4 / §4.1
 *
 * 본 파일의 JobMarketResultSchema 는 registration.ts 의 MarketResultSchema 와 의도적으로
 * 분리 — history 의 행은 RPC view 형식(예: updatedAt 포함, marketAccountId 비포함) 으로
 * 별도 정의.
 */

// ─────────────────────────────────────────────
// 목록 row — list_registration_jobs RPC
// ─────────────────────────────────────────────
export const JobSummarySchema = z.object({
  id: z.string().uuid(),
  status: RegistrationJobStatusSchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  retryCount: z.number().int().min(0).max(5),
  errorSummary: z.string().nullable(),
  parentJobId: z.string().uuid().nullable(),
  productId: z.string().uuid(),
  productName: z.string(),
  productThumbnailId: z.string().uuid().nullable(),
  marketSummary: z.array(
    z.object({
      marketId: MarketIdSchema,
      marketStatus: MarketResultStatusSchema,
      excluded: z.boolean(),
    }),
  ),
})
export type JobSummary = z.infer<typeof JobSummarySchema>

// ─────────────────────────────────────────────
// 상세 — get_registration_job RPC
// ─────────────────────────────────────────────
export const JobMarketResultSchema = z.object({
  id: z.string().uuid(),
  marketId: MarketIdSchema,
  marketStatus: MarketResultStatusSchema,
  externalProductId: z.string().nullable(),
  productUrl: z.string().url().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attemptCount: z.number().int().min(0).max(3),
  lastAttemptedAt: z.string().datetime().nullable(),
  excluded: z.boolean(),
  updatedAt: z.string().datetime(),
})
export type JobMarketResult = z.infer<typeof JobMarketResultSchema>

export const JobDetailSchema = z.object({
  job: z.object({
    id: z.string().uuid(),
    sellerId: z.string().uuid(),
    productId: z.string().uuid(),
    status: RegistrationJobStatusSchema,
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    retryCount: z.number().int().min(0).max(5),
    errorSummary: z.string().nullable(),
    cancelledAt: z.string().datetime().nullable(),
    parentJobId: z.string().uuid().nullable(),
    correlationId: z.string().uuid(),
  }),
  cancelledByMaskedId: z.string().nullable(),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    thumbnailImageId: z.string().uuid().nullable(),
  }),
  parent: z
    .object({
      id: z.string().uuid(),
      status: RegistrationJobStatusSchema,
      createdAt: z.string().datetime(),
    })
    .nullable(),
  children: z.array(
    z.object({
      id: z.string().uuid(),
      status: RegistrationJobStatusSchema,
      createdAt: z.string().datetime(),
    }),
  ),
  marketResults: z.array(JobMarketResultSchema),
})
export type JobDetail = z.infer<typeof JobDetailSchema>

// ─────────────────────────────────────────────
// 필터 + 페이지네이션
// ─────────────────────────────────────────────
export const PeriodPresetSchema = z.enum(['today', '7d', '30d', 'custom'])
export type PeriodPreset = z.infer<typeof PeriodPresetSchema>

export const HistoryFilterSchema = z
  .object({
    period: PeriodPresetSchema.default('30d'),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    markets: z.array(MarketIdSchema).optional(),
    statuses: z.array(RegistrationJobStatusSchema).optional(),
    q: z.string().max(100).optional(),
    cursor: z.string().datetime().optional(),
    cursorId: z.string().uuid().optional(),
    pageSize: z.union([z.literal(20), z.literal(50)]).default(20),
  })
  .superRefine((v, ctx) => {
    if (v.period === 'custom') {
      if (!v.from || !v.to) {
        ctx.addIssue({
          code: 'custom',
          message: 'custom 기간은 from/to 필수',
          path: ['from'],
        })
      } else if (v.from > v.to) {
        ctx.addIssue({
          code: 'custom',
          message: 'from 은 to 이전이어야 합니다',
          path: ['from'],
        })
      }
    }
  })
export type HistoryFilter = z.infer<typeof HistoryFilterSchema>
