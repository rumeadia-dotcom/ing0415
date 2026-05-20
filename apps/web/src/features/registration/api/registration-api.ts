import type { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  RegistrationJobSchema,
  MarketResultSchema,
  Step4ValidationSchema,
  type MarketResult,
  type RegistrationJob,
} from '@/lib/schemas/registration'
import { z as zod } from 'zod'

/**
 * registration 도메인 Edge Function invoke 래퍼.
 * 마스터: docs/architecture/v1/features/registration.md §6
 *
 * - 모든 호출은 zod 로 응답 parse → 스키마 위반 시 throw.
 * - Edge Function 에러 응답은 RegistrationErrorBodySchema 로 parse → RegistrationApiError 로 wrap.
 */

export class RegistrationApiError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(payload: { code: string; message: string; correlationId?: string | undefined }, raw?: unknown) {
    super(payload.message)
    this.name = 'RegistrationApiError'
    this.code = payload.code
    this.correlationId = payload.correlationId ?? null
    this.raw = raw
  }
}

const ErrorBodySchema = zod.object({
  code: zod.string(),
  message: zod.string(),
  correlationId: zod.string().uuid().optional(),
})

interface InvokeOpts<TReq, TRes> {
  fn: string
  request: TReq
  requestSchema: z.ZodType<TReq>
  responseSchema: z.ZodType<TRes>
}

async function invokeEdge<TReq, TRes>({ fn, request, requestSchema, responseSchema }: InvokeOpts<TReq, TRes>): Promise<TRes> {
  const safeReq = requestSchema.parse(request)
  const supabase = getSupabase()
  const { data, error } = await supabase.functions.invoke<unknown>(fn, {
    body: safeReq as unknown as Record<string, unknown>,
  })

  if (error) {
    logger.warn({ fn, err: error.message }, '← registration edge function error')
    const parsed = ErrorBodySchema.safeParse((error as { context?: { body?: unknown } }).context?.body ?? data)
    if (parsed.success) throw new RegistrationApiError(parsed.data, error)
    throw new RegistrationApiError({ code: 'internal', message: error.message }, error)
  }

  const errParsed = ErrorBodySchema.safeParse(data)
  if (errParsed.success && errParsed.data.code) {
    throw new RegistrationApiError(errParsed.data, data)
  }

  return responseSchema.parse(data)
}

// ─────────────────────────────────────────────
// 6.2 validate
// ─────────────────────────────────────────────

export const ValidateRequestSchema = zod.object({
  productId: zod.string().uuid(),
  marketIds: zod.array(zod.enum(['naver', 'coupang', '11st', 'gmarket', 'auction'])).min(1).max(5),
})
export type ValidateRequest = z.infer<typeof ValidateRequestSchema>

export function registrationValidate(req: ValidateRequest) {
  return invokeEdge({
    fn: 'registration-validate',
    request: req,
    requestSchema: ValidateRequestSchema,
    responseSchema: Step4ValidationSchema,
  })
}

// ─────────────────────────────────────────────
// 6.3 start
// ─────────────────────────────────────────────

export const StartRequestSchema = zod.object({
  productId: zod.string().uuid(),
  marketIds: zod.array(zod.string()).min(1).max(5),
  parentJobId: zod.string().uuid().optional(),
})
export type StartRequest = z.infer<typeof StartRequestSchema>

const StartResponseSchema = zod.object({
  jobId: zod.string().uuid(),
  status: zod.literal('pending'),
  marketResults: zod.array(
    zod.object({
      marketId: zod.string(),
      marketAccountId: zod.string().uuid(),
      status: zod.literal('pending'),
    }),
  ),
})
export type StartResponse = z.infer<typeof StartResponseSchema>

export function registrationStart(req: StartRequest): Promise<StartResponse> {
  return invokeEdge({
    fn: 'registration-start',
    request: req,
    requestSchema: StartRequestSchema,
    responseSchema: StartResponseSchema,
  })
}

// ─────────────────────────────────────────────
// 6.5 retry
// ─────────────────────────────────────────────

export const RetryRequestSchema = zod.object({
  jobId: zod.string().uuid(),
  marketResultIds: zod.array(zod.string().uuid()).optional(),
})
export type RetryRequest = z.infer<typeof RetryRequestSchema>

const RetryResponseSchema = zod.object({
  jobId: zod.string().uuid(),
  status: zod.literal('retrying'),
  retried: zod.array(zod.object({ marketResultId: zod.string().uuid(), marketId: zod.string() })),
})
export type RetryResponse = z.infer<typeof RetryResponseSchema>

export function registrationRetry(req: RetryRequest): Promise<RetryResponse> {
  return invokeEdge({
    fn: 'registration-retry',
    request: req,
    requestSchema: RetryRequestSchema,
    responseSchema: RetryResponseSchema,
  })
}

// ─────────────────────────────────────────────
// 6.6 cancel
// ─────────────────────────────────────────────

export const CancelRequestSchema = zod.object({
  jobId: zod.string().uuid(),
  reason: zod.string().max(200).optional(),
})
export type CancelRequest = z.infer<typeof CancelRequestSchema>

const CancelResponseSchema = zod.object({
  jobId: zod.string().uuid(),
  status: zod.literal('cancelled'),
  cancelledAt: zod.string().datetime(),
})
export type CancelResponse = z.infer<typeof CancelResponseSchema>

export function registrationCancel(req: CancelRequest): Promise<CancelResponse> {
  return invokeEdge({
    fn: 'registration-cancel',
    request: req,
    requestSchema: CancelRequestSchema,
    responseSchema: CancelResponseSchema,
  })
}

// ─────────────────────────────────────────────
// Job + market_results 조회 (Step 5 본 데이터)
// ─────────────────────────────────────────────

interface JobRow {
  id: string
  seller_id: string
  product_id: string
  status: string
  retry_count: number
  error_summary: string | null
  parent_job_id: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface MarketResultRow {
  id: string
  job_id: string
  market_id: string
  market_account_id: string
  market_status: string
  external_product_id: string | null
  product_url: string | null
  error_code: string | null
  error_message: string | null
  attempt_count: number
  excluded: boolean
  last_attempted_at: string | null
}

export async function fetchJobWithResults(jobId: string): Promise<{ job: RegistrationJob; results: MarketResult[] }> {
  const supabase = getSupabase()
  const [{ data: jobData, error: jobErr }, { data: resData, error: resErr }] = await Promise.all([
    supabase.from('registration_jobs').select('*').eq('id', jobId).single<JobRow>(),
    supabase.from('registration_job_market_results').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
  ])

  if (jobErr) throw new RegistrationApiError({ code: 'internal', message: jobErr.message }, jobErr)
  if (resErr) throw new RegistrationApiError({ code: 'internal', message: resErr.message }, resErr)
  if (!jobData) throw new RegistrationApiError({ code: 'product_not_found', message: 'job not found' })

  const job = RegistrationJobSchema.parse({
    id: jobData.id,
    sellerId: jobData.seller_id,
    productId: jobData.product_id,
    status: jobData.status,
    retryCount: jobData.retry_count,
    errorSummary: jobData.error_summary,
    parentJobId: jobData.parent_job_id,
    createdAt: jobData.created_at,
    startedAt: jobData.started_at,
    completedAt: jobData.completed_at,
  })

  const results = (resData ?? []).map((row) => {
    const r = row as MarketResultRow
    return MarketResultSchema.parse({
      id: r.id,
      jobId: r.job_id,
      marketId: r.market_id,
      marketAccountId: r.market_account_id,
      marketStatus: r.market_status,
      externalProductId: r.external_product_id,
      productUrl: r.product_url,
      errorCode: r.error_code,
      errorMessage: r.error_message,
      attemptCount: r.attempt_count,
      excluded: r.excluded,
      lastAttemptedAt: r.last_attempted_at,
    })
  })

  return { job, results }
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────

export const registrationQueryKeys = {
  all: ['registration'] as const,
  job: (jobId: string) => ['registration', 'job', jobId] as const,
  duplicateName: (name: string) => ['registration', 'duplicate', name] as const,
}
