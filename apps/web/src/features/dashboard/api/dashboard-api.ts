import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  DashboardSummarySchema,
  RecentJobsResponseSchema,
  MarketHealthSchema,
  type DashboardSummary,
  type RecentJob,
  type MarketHealth,
} from '@/lib/schemas/dashboard-summary'
import { MarketAccountStatusSchema } from '@/lib/schemas/markets-feature'

/**
 * dashboard 도메인 데이터 fetcher.
 * 마스터: docs/architecture/v1/features/dashboard.md §3.
 *
 * - rpc_get_dashboard_summary().maybeSingle()  → 요약 카드 4개 (셀러당 0~1 row)
 * - rpc_get_recent_jobs(limit)                  → 최근 잡 N건
 * - market_accounts.status SELECT + groupBy    → 마켓 연결 헬스
 *
 * 응답은 zod parse → 위반 시 throw (UI 가 error 상태로 표시).
 */

export async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .rpc('rpc_get_dashboard_summary')
    .maybeSingle()
  if (error) {
    logger.warn({ err: error.message }, 'rpc_get_dashboard_summary failed')
    throw error
  }
  if (data === null) return null
  return DashboardSummarySchema.parse(data)
}

export async function fetchRecentJobs(limit = 20): Promise<RecentJob[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('rpc_get_recent_jobs', {
    p_limit: limit,
  })
  if (error) {
    logger.warn({ err: error.message }, 'rpc_get_recent_jobs failed')
    throw error
  }
  return RecentJobsResponseSchema.parse(data ?? [])
}

const MarketAccountStatusRowSchema = MarketAccountStatusSchema

export async function fetchMarketHealth(): Promise<MarketHealth> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('market_accounts')
    .select('status')
  if (error) {
    logger.warn({ err: error.message }, 'market_accounts SELECT failed')
    throw error
  }
  const counts = { active: 0, expired: 0, revoked: 0, error: 0, total: 0 }
  for (const row of data ?? []) {
    const parsed = MarketAccountStatusRowSchema.safeParse(row.status)
    if (!parsed.success) continue
    counts[parsed.data] += 1
    counts.total += 1
  }
  return MarketHealthSchema.parse(counts)
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────
export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: () => ['dashboard', 'summary'] as const,
  recentJobs: (limit: number) => ['dashboard', 'recent', limit] as const,
  marketHealth: () => ['dashboard', 'market-health'] as const,
}
