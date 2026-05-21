import type { z } from 'zod'
import { z as zod } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  ShippingPrintOrderSchema,
  ShippingDispatchPreviewSchema,
  ShippingJobSchema,
  ShippingJobMarketResultSchema,
  ShippingJobListItemSchema,
  MarkWaybillPrintedRequestSchema,
  MarkWaybillPrintedResponseSchema,
  ShippingDispatchStartRequestSchema,
  ShippingDispatchStartResponseSchema,
  ShippingDispatchRetryRequestSchema,
  ShippingDispatchRetryResponseSchema,
  type ShippingPrintOrder,
  type ShippingDispatchPreview,
  type ShippingJob,
  type ShippingJobMarketResult,
  type ShippingJobListItem,
  type MarkWaybillPrintedRequest,
  type MarkWaybillPrintedResponse,
  type ShippingDispatchStartRequest,
  type ShippingDispatchStartResponse,
  type ShippingDispatchRetryRequest,
  type ShippingDispatchRetryResponse,
} from '../types/shipping-schema'

/**
 * shipping 도메인 API 래퍼 (Edge Function invoke + Supabase select).
 *
 * 마스터: docs/architecture/v1/features/shipping.md (PR2 작성 예정).
 *
 * - 모든 응답은 zod parse → 스키마 위반 시 throw.
 * - Edge Function 에러 응답은 ErrorBody 로 parse → ShippingApiError 로 wrap.
 * - 외부 호출은 logger 로 구조화 로그 (orderIds / jobId 등 internal ID 만, PII 금지).
 */

export class ShippingApiError extends Error {
  readonly code: string
  readonly correlationId: string | null
  readonly raw: unknown

  constructor(
    payload: { code: string; message: string; correlationId?: string | undefined },
    raw?: unknown,
  ) {
    super(payload.message)
    this.name = 'ShippingApiError'
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

async function invokeEdge<TReq, TRes>({
  fn,
  request,
  requestSchema,
  responseSchema,
}: InvokeOpts<TReq, TRes>): Promise<TRes> {
  const safeReq = requestSchema.parse(request)
  const supabase = getSupabase()
  logger.info({ fn }, '→ shipping edge invoke')
  const { data, error } = await supabase.functions.invoke<unknown>(fn, {
    body: safeReq as unknown as Record<string, unknown>,
  })

  if (error) {
    logger.warn({ fn, err: error.message }, '← shipping edge function error')
    const parsed = ErrorBodySchema.safeParse(
      (error as { context?: { body?: unknown } }).context?.body ?? data,
    )
    if (parsed.success) throw new ShippingApiError(parsed.data, error)
    throw new ShippingApiError({ code: 'internal', message: error.message }, error)
  }

  const errParsed = ErrorBodySchema.safeParse(data)
  if (errParsed.success && errParsed.data.code) {
    throw new ShippingApiError(errParsed.data, data)
  }

  return responseSchema.parse(data)
}

// ─────────────────────────────────────────────
// SELECT: 운송장 출력 대상 주문 (n52)
// ─────────────────────────────────────────────

interface OrderRow {
  id: string
  market_id: string
  market_order_no: string
  product_name: string
  buyer_name: string
  waybill_number: string | null
  shipping_status: string
  registered_at: string
}

export async function fetchShippingPrintList(): Promise<ShippingPrintOrder[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, market_id, market_order_no, product_name, buyer_name, waybill_number, shipping_status, registered_at',
    )
    .eq('shipping_status', 'logen_registered')
    .order('registered_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new ShippingApiError({ code: 'internal', message: error.message }, error)
  }

  const rows = (data ?? []) as OrderRow[]
  return rows
    .filter((r): r is OrderRow & { waybill_number: string } => r.waybill_number !== null)
    .map((r) =>
      ShippingPrintOrderSchema.parse({
        orderId: r.id,
        marketId: r.market_id,
        marketOrderNo: r.market_order_no,
        productName: r.product_name,
        buyerName: r.buyer_name,
        waybillNumber: r.waybill_number,
        shippingStatus: r.shipping_status,
        registeredAt: r.registered_at,
      }),
    )
}

// ─────────────────────────────────────────────
// SELECT: 송장 일괄 제출 미리보기 (n53)
// ─────────────────────────────────────────────

export async function fetchShippingDispatchPreview(): Promise<ShippingDispatchPreview> {
  const supabase = getSupabase()
  // 미연동 PR7 이전: orders 테이블에서 직접 count + group.
  // PR7 가 RPC `shipping_dispatch_preview` 를 제공하면 그쪽으로 교체.
  const { data, error } = await supabase
    .from('orders')
    .select('market_id, shipping_status')
    .in('shipping_status', ['logen_registered', 'waybill_printed'])

  if (error) {
    throw new ShippingApiError({ code: 'internal', message: error.message }, error)
  }

  interface Row {
    market_id: string
    shipping_status: string
  }
  const rows = (data ?? []) as Row[]
  const printedRows = rows.filter((r) => r.shipping_status === 'waybill_printed')
  const unprintedRows = rows.filter((r) => r.shipping_status === 'logen_registered')

  const groupMap = new Map<string, number>()
  for (const r of printedRows) {
    groupMap.set(r.market_id, (groupMap.get(r.market_id) ?? 0) + 1)
  }

  const marketGroups: { marketId: string; orderCount: number }[] = Array.from(
    groupMap.entries(),
  ).map(([marketId, count]) => ({ marketId, orderCount: count }))

  return ShippingDispatchPreviewSchema.parse({
    totalOrders: printedRows.length,
    printedOrders: printedRows.length,
    unprintedOrders: unprintedRows.length,
    marketGroups,
  })
}

// ─────────────────────────────────────────────
// SELECT: 단일 job + market_results (n54 / n55)
// ─────────────────────────────────────────────

interface ShippingJobRow {
  id: string
  seller_id: string
  status: string
  total_orders: number
  retry_count: number
  error_summary: string | null
  parent_job_id: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface ShippingMarketResultRow {
  id: string
  job_id: string
  market_id: string
  market_account_id: string
  status: string
  total_orders: number
  success_orders: number
  failed_orders: number
  error_code: string | null
  error_message: string | null
  attempt_count: number
  last_attempted_at: string | null
}

export async function fetchShippingJobWithResults(
  jobId: string,
): Promise<{ job: ShippingJob; results: ShippingJobMarketResult[] }> {
  const supabase = getSupabase()
  const [{ data: jobData, error: jobErr }, { data: resData, error: resErr }] = await Promise.all([
    supabase.from('shipping_jobs').select('*').eq('id', jobId).single<ShippingJobRow>(),
    supabase
      .from('shipping_job_market_results')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
  ])

  if (jobErr) throw new ShippingApiError({ code: 'internal', message: jobErr.message }, jobErr)
  if (resErr) throw new ShippingApiError({ code: 'internal', message: resErr.message }, resErr)
  if (!jobData) throw new ShippingApiError({ code: 'job_not_found', message: 'shipping job not found' })

  const job = ShippingJobSchema.parse({
    id: jobData.id,
    sellerId: jobData.seller_id,
    status: jobData.status,
    totalOrders: jobData.total_orders,
    retryCount: jobData.retry_count,
    errorSummary: jobData.error_summary,
    parentJobId: jobData.parent_job_id,
    createdAt: jobData.created_at,
    startedAt: jobData.started_at,
    completedAt: jobData.completed_at,
  })

  const results = (resData ?? []).map((row) => {
    const r = row as ShippingMarketResultRow
    return ShippingJobMarketResultSchema.parse({
      id: r.id,
      jobId: r.job_id,
      marketId: r.market_id,
      marketAccountId: r.market_account_id,
      status: r.status,
      totalOrders: r.total_orders,
      successOrders: r.success_orders,
      failedOrders: r.failed_orders,
      errorCode: r.error_code,
      errorMessage: r.error_message,
      attemptCount: r.attempt_count,
      lastAttemptedAt: r.last_attempted_at,
    })
  })

  return { job, results }
}

// ─────────────────────────────────────────────
// SELECT: 이력 목록 (n57)
// ─────────────────────────────────────────────

interface ShippingJobListRow extends ShippingJobRow {
  success_count: number
  failed_count: number
  market_ids: string[]
}

export async function fetchShippingJobs(): Promise<ShippingJobListItem[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shipping_jobs_with_summary')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw new ShippingApiError({ code: 'internal', message: error.message }, error)
  }

  const rows = (data ?? []) as ShippingJobListRow[]
  return rows.map((r) =>
    ShippingJobListItemSchema.parse({
      id: r.id,
      sellerId: r.seller_id,
      status: r.status,
      totalOrders: r.total_orders,
      retryCount: r.retry_count,
      errorSummary: r.error_summary,
      parentJobId: r.parent_job_id,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      successCount: r.success_count,
      failedCount: r.failed_count,
      marketIds: r.market_ids,
    }),
  )
}

// ─────────────────────────────────────────────
// MUTATION: [출력 완료] (n52)
// ─────────────────────────────────────────────

export function markWaybillPrinted(
  req: MarkWaybillPrintedRequest,
): Promise<MarkWaybillPrintedResponse> {
  return invokeEdge({
    fn: 'shipping-mark-waybill-printed',
    request: req,
    requestSchema: MarkWaybillPrintedRequestSchema,
    responseSchema: MarkWaybillPrintedResponseSchema,
  })
}

// ─────────────────────────────────────────────
// MUTATION: [제출 시작] (n53 → n54)
// ─────────────────────────────────────────────

export function startShippingDispatch(
  req: ShippingDispatchStartRequest,
): Promise<ShippingDispatchStartResponse> {
  return invokeEdge({
    fn: 'shipping-dispatch-job',
    request: req,
    requestSchema: ShippingDispatchStartRequestSchema,
    responseSchema: ShippingDispatchStartResponseSchema,
  })
}

// ─────────────────────────────────────────────
// MUTATION: [재시도] (n56)
// ─────────────────────────────────────────────

export function retryShippingDispatch(
  req: ShippingDispatchRetryRequest,
): Promise<ShippingDispatchRetryResponse> {
  return invokeEdge({
    fn: 'shipping-dispatch-retry',
    request: req,
    requestSchema: ShippingDispatchRetryRequestSchema,
    responseSchema: ShippingDispatchRetryResponseSchema,
  })
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────

export const shippingQueryKeys = {
  all: ['shipping'] as const,
  printList: () => ['shipping', 'print-list'] as const,
  dispatchPreview: () => ['shipping', 'dispatch-preview'] as const,
  job: (jobId: string) => ['shipping', 'job', jobId] as const,
  jobs: () => ['shipping', 'jobs'] as const,
}
