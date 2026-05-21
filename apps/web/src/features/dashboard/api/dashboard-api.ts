import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  DashboardSummarySchema,
  MarketHealthSchema,
  MarketOrdersSummarySchema,
  type DashboardSummary,
  type MarketHealth,
  type MarketOrdersSummary,
  type MarketOrderItem,
  type MarketOrderSyncStatus,
} from '@/lib/schemas/dashboard-summary'
import { MarketAccountStatusSchema } from '@/lib/schemas/markets-feature'
import { MarketIdSchema, type MarketId } from '@/lib/schemas/common'

/**
 * dashboard 도메인 데이터 fetcher.
 * 마스터: docs/architecture/v1/features/dashboard.md §3 + docs/design-renewal/s2-dashboard.md §3.5
 *
 * - rpc_get_dashboard_summary().maybeSingle()  → 요약 카드 4개 (셀러당 0~1 row)
 * - orders_with_dispatch_summary + orders today + market_accounts → 마켓별 주문 현황
 * - market_accounts.status SELECT + groupBy    → 마켓 연결 헬스 (전체 카운트)
 *
 * 응답은 zod parse → 위반 시 throw (UI 가 error 상태로 표시).
 */

/** v1 정식 마켓 (UI 노출 순서). 11번가는 'oem_준비중' placeholder. */
const V1_MARKETS: readonly MarketId[] = ['naver', 'coupang', 'gmarket', 'auction']
const V1_COMING_SOON: readonly MarketId[] = ['11st']

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

/**
 * 마켓별 주문 현황 (s2 위젯).
 *
 * 조립 로직:
 *  1) orders_with_dispatch_summary view 에서 `by_market` 추출 → newOrdersCount / pendingCount
 *  2) orders 테이블에서 오늘 0시 이후 collected_at 행 마켓별 카운트 → todayTotalCount
 *  3) market_accounts 에서 마켓별 (가장 최근 last_verified_at, status) → lastSyncedAt / syncStatus
 *  4) V1_MARKETS 순서로 배열 생성. comingSoon = ['11st'].
 *
 * 한 마켓에 여러 계정이 있을 경우: status 는 우선순위 `error > expired > revoked > active`, lastSyncedAt 은 MAX.
 */
export async function fetchMarketOrdersSummary(): Promise<MarketOrdersSummary> {
  const supabase = getSupabase()

  // (1) orders_with_dispatch_summary.by_market — newOrdersCount + pendingCount
  const byMarketMap = new Map<MarketId, { newOrdersCount: number }>()
  const { data: summaryRow, error: summaryErr } = await supabase
    .from('orders_with_dispatch_summary')
    .select('by_market')
    .maybeSingle()
  if (summaryErr) {
    logger.warn(
      { err: summaryErr.message },
      'orders_with_dispatch_summary failed (market-orders)',
    )
    throw summaryErr
  }
  interface ByMarketRow { market_id: string; new_orders_count: number; pending_count: number }
  const byMarketRaw: readonly ByMarketRow[] =
    summaryRow && Array.isArray(summaryRow.by_market)
      ? (summaryRow.by_market as ByMarketRow[])
      : []
  for (const row of byMarketRaw) {
    const parsed = MarketIdSchema.safeParse(row.market_id)
    if (!parsed.success) continue
    byMarketMap.set(parsed.data, { newOrdersCount: row.new_orders_count })
  }

  // (2) orders 오늘 카운트 (collected_at >= today 0시 KST)
  const todayMap = new Map<MarketId, number>()
  const todayStart = startOfTodayKstIso()
  const { data: todayRows, error: todayErr } = await supabase
    .from('orders')
    .select('market_id')
    .gte('collected_at', todayStart)
  if (todayErr) {
    logger.warn({ err: todayErr.message }, 'orders today SELECT failed')
    throw todayErr
  }
  for (const row of (todayRows ?? []) as { market_id: string }[]) {
    const parsed = MarketIdSchema.safeParse(row.market_id)
    if (!parsed.success) continue
    todayMap.set(parsed.data, (todayMap.get(parsed.data) ?? 0) + 1)
  }

  // (3) market_accounts 마켓별 status / last_verified_at / last_error_code
  const accountsMap = new Map<MarketId, {
    syncStatus: MarketOrderSyncStatus
    lastSyncedAt: string | null
    syncError: string | null
  }>()
  const { data: accountRows, error: accountErr } = await supabase
    .from('market_accounts')
    .select('market_id,status,last_verified_at,last_error_code')
  if (accountErr) {
    logger.warn({ err: accountErr.message }, 'market_accounts SELECT (market-orders) failed')
    throw accountErr
  }
  interface AccountRow {
    market_id: string
    status: string
    last_verified_at: string | null
    last_error_code: string | null
  }
  // 우선순위 매핑: account.status → syncStatus.
  //   error          → 'error'
  //   expired/revoked→ 'error' (재인증 필요)
  //   active         → 'idle'
  const toSyncStatus = (s: string): MarketOrderSyncStatus =>
    s === 'active' ? 'idle' : 'error'
  const severity = (s: MarketOrderSyncStatus): number => (s === 'error' ? 2 : 1)
  for (const row of (accountRows ?? []) as AccountRow[]) {
    const mp = MarketIdSchema.safeParse(row.market_id)
    if (!mp.success) continue
    const next: MarketOrderSyncStatus = toSyncStatus(row.status)
    const prev = accountsMap.get(mp.data)
    if (!prev) {
      accountsMap.set(mp.data, {
        syncStatus: next,
        lastSyncedAt: row.last_verified_at,
        syncError: row.last_error_code,
      })
      continue
    }
    // 더 심각한 상태 우선. 같으면 lastSyncedAt MAX.
    if (severity(next) > severity(prev.syncStatus)) {
      accountsMap.set(mp.data, {
        syncStatus: next,
        lastSyncedAt: row.last_verified_at,
        syncError: row.last_error_code,
      })
    } else if (
      row.last_verified_at &&
      (!prev.lastSyncedAt || row.last_verified_at > prev.lastSyncedAt)
    ) {
      accountsMap.set(mp.data, {
        ...prev,
        lastSyncedAt: row.last_verified_at,
      })
    }
  }

  const markets: MarketOrderItem[] = V1_MARKETS.map((marketId) => {
    const byMarket = byMarketMap.get(marketId)
    const account = accountsMap.get(marketId)
    return {
      marketId,
      newOrdersCount: byMarket?.newOrdersCount ?? 0,
      todayTotalCount: todayMap.get(marketId) ?? 0,
      lastSyncedAt: account?.lastSyncedAt ?? null,
      syncStatus: account?.syncStatus ?? 'idle',
      syncError: account?.syncError ?? null,
    }
  })

  return MarketOrdersSummarySchema.parse({
    markets,
    comingSoon: [...V1_COMING_SOON],
  })
}

/** 오늘 KST 0시 ISO 8601 + offset. orders.collected_at 비교용. */
function startOfTodayKstIso(): string {
  const now = new Date()
  // KST = UTC+9. 자정 = UTC 전날 15:00.
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = kstNow.getUTCFullYear()
  const m = String(kstNow.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kstNow.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00+09:00`
}

// ─────────────────────────────────────────────
// Query Key 팩토리
// ─────────────────────────────────────────────
export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  summary: () => ['dashboard', 'summary'] as const,
  marketOrders: () => ['dashboard', 'market-orders'] as const,
  marketHealth: () => ['dashboard', 'market-health'] as const,
}
