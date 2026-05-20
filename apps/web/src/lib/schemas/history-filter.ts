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

// ─────────────────────────────────────────────
// URL search params ↔ HistoryFilter round-trip
// ─────────────────────────────────────────────
// 컨벤션: 배열 필드 (markets / statuses) 는 콤마(`,`) 구분 string. 빈/디폴트 값은 URL 에서 생략.
// 디폴트 = period:'30d', pageSize:20. 디폴트와 동일하면 URL 에 쓰지 않음.

const DEFAULT_HISTORY_FILTER: HistoryFilter = {
  period: '30d',
  pageSize: 20,
}

function splitCsv<T extends string>(raw: string | null, validValues: readonly T[]): T[] | undefined {
  if (!raw) return undefined
  const parts = raw.split(',').filter(Boolean) as T[]
  const valid = parts.filter((p): p is T => (validValues as readonly string[]).includes(p))
  return valid.length > 0 ? valid : undefined
}

/**
 * URLSearchParams → HistoryFilter (zod parse).
 * 잘못된 값은 디폴트로 fallback (zod 의 default 활용). 명시적 throw 하지 않음 — UI iteration 도중 URL 깨짐 회피.
 */
export function historyFilterFromSearchParams(
  params: URLSearchParams,
): HistoryFilter {
  const raw = {
    period: params.get('period') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    markets: splitCsv(params.get('market'), [
      'naver',
      'coupang',
      '11st',
      'gmarket',
      'auction',
    ] as const),
    statuses: splitCsv(params.get('status'), [
      'pending',
      'running',
      'partial',
      'succeeded',
      'failed',
      'retrying',
      'cancelled',
    ] as const),
    q: params.get('q') ?? undefined,
    cursor: params.get('cursor') ?? undefined,
    cursorId: params.get('cursorId') ?? undefined,
    pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : undefined,
  }
  const result = HistoryFilterSchema.safeParse(raw)
  return result.success ? result.data : DEFAULT_HISTORY_FILTER
}

/**
 * HistoryFilter → URLSearchParams. 디폴트 값은 생략하여 URL 짧게 유지.
 */
export function historyFilterToSearchParams(filter: HistoryFilter): URLSearchParams {
  const params = new URLSearchParams()
  if (filter.period !== DEFAULT_HISTORY_FILTER.period) params.set('period', filter.period)
  if (filter.from) params.set('from', filter.from)
  if (filter.to) params.set('to', filter.to)
  if (filter.markets && filter.markets.length > 0) {
    params.set('market', filter.markets.join(','))
  }
  if (filter.statuses && filter.statuses.length > 0) {
    params.set('status', filter.statuses.join(','))
  }
  if (filter.q) params.set('q', filter.q)
  if (filter.cursor) params.set('cursor', filter.cursor)
  if (filter.cursorId) params.set('cursorId', filter.cursorId)
  if (filter.pageSize !== DEFAULT_HISTORY_FILTER.pageSize) {
    params.set('pageSize', String(filter.pageSize))
  }
  return params
}

/**
 * period preset → (from, to) ISO date 범위 계산.
 * - today: 오늘 00:00 (Asia/Seoul) ~ 내일 00:00
 * - 7d / 30d: 현재 시각 기준 N일 전 ~ 현재
 * - custom: filter.from/to 그대로 사용 (검증은 superRefine 에서 끝남)
 */
export function periodToRange(filter: HistoryFilter): { from?: string; to?: string } {
  const now = new Date()
  if (filter.period === 'custom') {
    const out: { from?: string; to?: string } = {}
    if (filter.from) out.from = filter.from
    if (filter.to) out.to = filter.to
    return out
  }
  if (filter.period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  const days = filter.period === '7d' ? 7 : 30
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: start.toISOString(), to: now.toISOString() }
}
