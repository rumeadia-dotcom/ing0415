import { z } from 'zod'
import { MarketIdSchema } from './common'
import {
  MarketResultStatusSchema,
  RegistrationJobStatusSchema,
} from './registration'

/**
 * 대시보드 도메인 zod 스키마.
 * 마스터: docs/architecture/v1/features/dashboard.md §3.4
 *
 * 필드는 RPC 응답 그대로 snake_case 유지 (DB view 와 매핑 단순화).
 */

export const RecentJobMarketSchema = z.object({
  market_id: MarketIdSchema,
  market_status: MarketResultStatusSchema,
  attempt_count: z.number().int().min(0).max(3),
  external_product_id: z.string().nullable(),
  product_url: z.string().url().nullable(),
  error_code: z.string().nullable(),
  excluded: z.boolean(),
})
export type RecentJobMarket = z.infer<typeof RecentJobMarketSchema>

export const DashboardSummarySchema = z.object({
  seller_id: z.string().uuid(),
  jobs_today_count: z.number().int().nonnegative(),
  jobs_in_progress_count: z.number().int().nonnegative(),
  jobs_24h_count: z.number().int().nonnegative(),
  jobs_24h_succeeded: z.number().int().nonnegative(),
  jobs_24h_partial: z.number().int().nonnegative(),
  jobs_24h_failed: z.number().int().nonnegative(),
  jobs_7d_count: z.number().int().nonnegative(),
  jobs_7d_succeeded: z.number().int().nonnegative(),
  jobs_7d_partial: z.number().int().nonnegative(),
  jobs_7d_failed: z.number().int().nonnegative(),
  jobs_30d_count: z.number().int().nonnegative(),
  avg_duration_sec_7d: z.coerce.number().nonnegative(),
  last_job_at: z.string().datetime({ offset: true }).nullable(),
})
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>

export const RecentJobSchema = z.object({
  job_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  product_id: z.string().uuid(),
  job_status: RegistrationJobStatusSchema,
  created_at: z.string().datetime({ offset: true }),
  started_at: z.string().datetime({ offset: true }).nullable(),
  completed_at: z.string().datetime({ offset: true }).nullable(),
  retry_count: z.number().int().min(0).max(5),
  error_summary: z.string().nullable(),
  parent_job_id: z.string().uuid().nullable(),
  markets: z.array(RecentJobMarketSchema),
  success_count: z.number().int().nonnegative(),
  failed_count: z.number().int().nonnegative(),
  market_total_count: z.number().int().nonnegative(),
})
export type RecentJob = z.infer<typeof RecentJobSchema>

export const RecentJobsResponseSchema = z.array(RecentJobSchema).max(50)

// ─────────────────────────────────────────────
// MarketHealth — market_accounts 의 status 그룹 집계
// 클라이언트가 from('market_accounts').select('status') 후 groupBy 한 결과의 zod 형태.
// ─────────────────────────────────────────────
export const MarketHealthSchema = z.object({
  active: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  revoked: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})
export type MarketHealth = z.infer<typeof MarketHealthSchema>

// ─────────────────────────────────────────────
// MarketOrdersSummary — s2 대시보드 "마켓별 주문 현황" 위젯 (v1 에서 "최근 등록" 대체)
// 마스터: docs/design-renewal/s2-dashboard.md §3.5
// 데이터 소스 합성:
//   - orders_with_dispatch_summary.by_market  → newOrdersCount / pendingCount
//   - orders 테이블 (collected_at >= 오늘 0시) → todayTotalCount
//   - market_accounts (marketId 단위 status / last_verified_at) → syncStatus / lastSyncedAt
// ─────────────────────────────────────────────
export const MarketOrderSyncStatusSchema = z.enum(['idle', 'syncing', 'error'])
export type MarketOrderSyncStatus = z.infer<typeof MarketOrderSyncStatusSchema>

export const MarketOrderItemSchema = z.object({
  marketId: MarketIdSchema,
  // 셀러가 해당 마켓 계정을 연동했는지 (market_accounts 행 존재 여부). false 면 위젯에서 비활성 행으로 렌더.
  connected: z.boolean(),
  newOrdersCount: z.number().int().nonnegative(),
  todayTotalCount: z.number().int().nonnegative(),
  lastSyncedAt: z.string().datetime({ offset: true }).nullable(),
  syncStatus: MarketOrderSyncStatusSchema,
  syncError: z.string().nullable(),
})
export type MarketOrderItem = z.infer<typeof MarketOrderItemSchema>

export const MarketOrdersSummarySchema = z.object({
  markets: z.array(MarketOrderItemSchema),
  comingSoon: z.array(MarketIdSchema),
})
export type MarketOrdersSummary = z.infer<typeof MarketOrdersSummarySchema>
