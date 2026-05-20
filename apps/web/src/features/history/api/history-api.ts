import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  HistoryFilterSchema,
  JobSummarySchema,
  JobDetailSchema,
  periodToRange,
  type HistoryFilter,
  type JobSummary,
  type JobDetail,
} from '@/lib/schemas/history-filter'
import { MARKET_IDS } from '@/lib/schemas/common'

/**
 * history 도메인 데이터 fetcher.
 * 마스터: docs/architecture/v1/features/history.md §3.
 *
 * - list_registration_jobs(...)  → 목록 (keyset cursor 페이지네이션)
 * - get_registration_job(p_job_id) → 상세 (jsonb 단일)
 *
 * snake_case → camelCase 매핑은 본 파일이 책임. zod parse 는 매핑 후.
 */

// list_registration_jobs RPC 의 raw row shape (snake_case)
const RawListRowSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  retry_count: z.number().int(),
  error_summary: z.string().nullable(),
  parent_job_id: z.string().uuid().nullable(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  product_thumbnail_id: z.string().uuid().nullable(),
  market_summary: z.unknown(),
  total_count: z.number().int().nonnegative(),
})

export interface HistoryListPage {
  items: JobSummary[]
  totalCount: number
  nextCursor: { cursor: string; cursorId: string } | null
}

export async function fetchHistoryList(filter: HistoryFilter): Promise<HistoryListPage> {
  const supabase = getSupabase()
  const safeFilter = HistoryFilterSchema.parse(filter)
  const range = periodToRange(safeFilter)

  const { data, error } = await supabase.rpc('list_registration_jobs', {
    p_from: range.from ?? null,
    p_to: range.to ?? null,
    p_markets: safeFilter.markets ?? null,
    p_statuses: safeFilter.statuses ?? null,
    p_q: safeFilter.q ?? null,
    p_limit: safeFilter.pageSize,
    p_cursor: safeFilter.cursor ?? null,
    p_cursor_id: safeFilter.cursorId ?? null,
  })
  if (error) {
    logger.warn({ err: error.message }, 'list_registration_jobs failed')
    throw error
  }

  const rawRows = z.array(RawListRowSchema).parse(data ?? [])
  const items = rawRows.map(mapListRow)
  const totalCount = rawRows[0]?.total_count ?? 0
  const last = rawRows[rawRows.length - 1]
  const nextCursor =
    last && rawRows.length >= safeFilter.pageSize
      ? { cursor: last.created_at, cursorId: last.id }
      : null

  return { items, totalCount, nextCursor }
}

function mapListRow(row: z.infer<typeof RawListRowSchema>): JobSummary {
  const marketSummary = Array.isArray(row.market_summary)
    ? (row.market_summary as Record<string, unknown>[]).map((m) => ({
        marketId: String(m['market_id']),
        marketStatus: String(m['market_status']),
        excluded: Boolean(m['excluded']),
      }))
    : []
  return JobSummarySchema.parse({
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retryCount: row.retry_count,
    errorSummary: row.error_summary,
    parentJobId: row.parent_job_id,
    productId: row.product_id,
    productName: row.product_name,
    productThumbnailId: row.product_thumbnail_id,
    marketSummary,
  })
}

// get_registration_job RPC 응답 jsonb 안의 'job' 블록만 snake_case → camelCase 변환.
// 나머지 (product, parent, children, marketResults, cancelledByMaskedId) 는 RPC 가 이미 camelCase.
function remapDetailPayload(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = raw as Record<string, unknown>
  const job = r['job']
  if (typeof job !== 'object' || job === null) return raw
  const j = job as Record<string, unknown>
  return {
    ...r,
    job: {
      id: j['id'],
      sellerId: j['seller_id'],
      productId: j['product_id'],
      status: j['status'],
      createdAt: j['created_at'],
      startedAt: j['started_at'],
      completedAt: j['completed_at'],
      retryCount: j['retry_count'],
      errorSummary: j['error_summary'],
      cancelledAt: j['cancelled_at'],
      parentJobId: j['parent_job_id'],
      correlationId: j['correlation_id'],
    },
  }
}

export async function fetchHistoryDetail(jobId: string): Promise<JobDetail | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('get_registration_job', {
    p_job_id: jobId,
  })
  if (error) {
    logger.warn({ err: error.message, jobId }, 'get_registration_job failed')
    throw error
  }
  if (data === null) return null
  return JobDetailSchema.parse(remapDetailPayload(data))
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────
export const historyQueryKeys = {
  all: ['history'] as const,
  list: (filter: HistoryFilter) => ['history', 'list', serializeFilterKey(filter)] as const,
  detail: (jobId: string) => ['history', 'detail', jobId] as const,
}

function serializeFilterKey(filter: HistoryFilter): string {
  // queryKey 안정성을 위해 정렬된 형태로 직렬화 (cursor 는 제외 — infinite query 의 pageParam 이 cursor 담당)
  const parts: string[] = [
    `period:${filter.period}`,
    `from:${filter.from ?? ''}`,
    `to:${filter.to ?? ''}`,
    `markets:${[...(filter.markets ?? [])].sort().join(',')}`,
    `statuses:${[...(filter.statuses ?? [])].sort().join(',')}`,
    `q:${filter.q ?? ''}`,
    `pageSize:${filter.pageSize}`,
  ]
  return parts.join('|')
}

// MARKET_IDS 는 향후 마켓 추가 시 본 파일에서 import 검증용 (현재는 schemas 가 검증)
void MARKET_IDS
