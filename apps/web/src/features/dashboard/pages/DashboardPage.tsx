import { Link } from 'react-router-dom'
import { PackagePlus, Clock, CheckCircle2, Timer } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useMarketOrdersSummary } from '../hooks/useMarketOrdersSummary'
import { useMarketHealth } from '../hooks/useMarketHealth'
import { SummaryCard } from '../components/SummaryCard'
import { MarketOrdersSummaryCard } from '../components/MarketOrdersSummaryCard'
import { MarketHealthCard } from '../components/MarketHealthCard'
import { DashboardEmptyState } from '../components/DashboardEmptyState'
import { formatDurationSec } from '@/lib/format-time'

/**
 * DashboardPage — s2 (n9~n14, v1).
 * 마스터: docs/design-renewal/s2-dashboard.md + docs/architecture/v1/features/dashboard.md
 * 디자인: docs/design-renewal/designFile/concepts/studio.jsx (KPI strip + market list + recent jobs)
 *
 * Studio 룩 — 레이아웃 (desktop ≥ lg):
 *   PageHeader
 *   ─ KPI strip (4 카드, display 34 ink, uppercase label, tone dot)
 *   ─ Empty state OR 2-column (MarketOrdersSummary 좌, MarketHealth + v2 placeholder 우)
 *
 * 4상태 + partial 시각화는 각 자식 컴포넌트가 책임.
 */
export function DashboardPage(): JSX.Element {
  const summary = useDashboardSummary()
  const marketOrders = useMarketOrdersSummary()
  const health = useMarketHealth()

  const hasNoConnectedMarkets =
    !health.isLoading && !health.isError && (health.data?.total ?? 0) === 0
  const hasNoJobs = summary.data?.last_job_at === null
  const totalOrders =
    marketOrders.data?.markets.reduce(
      (acc, m) => acc + m.newOrdersCount + m.todayTotalCount,
      0,
    ) ?? 0
  // s2-dashboard.md §6.2 빈 상태 분기:
  //  (a) 마켓 0건 → 최우선 hero ("먼저 마켓 연결")
  //  (b) 마켓 ≥1 + 주문 0건 + 잡 0건 → "첫 상품 등록"
  const emptyVariant: 'no-markets' | 'no-activity' | null = hasNoConnectedMarkets
    ? 'no-markets'
    : hasNoJobs && totalOrders === 0
      ? 'no-activity'
      : null

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="대시보드"
        subtitle="오늘의 주문과 등록 현황을 한눈에 확인하세요"
        actions={
          <Button asChild className="rounded-[10px]">
            <Link to="/register">
              <PackagePlus className="mr-2 h-4 w-4" aria-hidden />
              상품 등록
            </Link>
          </Button>
        }
      />

      <SummaryGrid summary={summary} />

      {emptyVariant !== null ? (
        <div className="mt-5">
          <DashboardEmptyState variant={emptyVariant} />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MarketOrdersSummaryCard
              state={
                marketOrders.isLoading
                  ? 'loading'
                  : marketOrders.isError
                    ? 'error'
                    : !marketOrders.data || marketOrders.data.markets.length === 0
                      ? 'empty'
                      : 'data'
              }
              data={marketOrders.data}
              errorMessage={marketOrders.error?.message}
              hasNoConnectedMarkets={hasNoConnectedMarkets}
            />
          </div>
          <div className="space-y-4">
            <MarketHealthCard
              state={health.isLoading ? 'loading' : health.isError ? 'error' : 'data'}
              {...(health.data !== undefined ? { health: health.data } : {})}
            />
            <V2PlaceholderCard />
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryGrid({
  summary,
}: {
  summary: ReturnType<typeof useDashboardSummary>
}): JSX.Element {
  // 4상태: data null 도 'data' 로 취급하고 화면에서는 0건/—로 표시 — RPC 가 빈 row 반환을 "잡 0건" 의미로 사용.
  const baseState: 'loading' | 'data' | 'error' = summary.isLoading
    ? 'loading'
    : summary.isError
      ? 'error'
      : 'data'

  const data = summary.data ?? null
  const successRate7d =
    data && data.jobs_7d_count > 0
      ? Math.round((data.jobs_7d_succeeded / data.jobs_7d_count) * 100)
      : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <SummaryCard
        label="오늘 등록"
        value={`${data?.jobs_today_count ?? 0}건`}
        state={baseState}
        tone="accent"
        icon={<PackagePlus className="h-4 w-4" aria-hidden />}
      />
      <SummaryCard
        label="진행 중"
        value={`${data?.jobs_in_progress_count ?? 0}건`}
        state={baseState}
        tone="info"
        icon={<Clock className="h-4 w-4" aria-hidden />}
      />
      <SummaryCard
        label="7일 성공률"
        value={successRate7d !== null ? `${successRate7d}%` : '—'}
        hint={
          data && data.jobs_7d_count > 0
            ? `${data.jobs_7d_succeeded}/${data.jobs_7d_count}건`
            : '집계 데이터 없음'
        }
        state={baseState}
        tone="ok"
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
      />
      <SummaryCard
        label="평균 소요 (7일)"
        value={data && data.avg_duration_sec_7d > 0 ? formatDurationSec(data.avg_duration_sec_7d) : '—'}
        hint="성공 잡 기준"
        state={baseState}
        tone="dim"
        icon={<Timer className="h-4 w-4" aria-hidden />}
      />
    </div>
  )
}

function V2PlaceholderCard(): JSX.Element {
  return (
    <Card
      data-feature="market-stats-v2"
      className="rounded-[14px] border-dashed border-border-strong bg-card-2 opacity-70"
    >
      <CardHeader className="px-4 py-4 pb-2">
        <CardTitle as="h2" className="text-[13.5px] font-bold text-dim">
          마켓별 통계 — v2
        </CardTitle>
        <CardDescription className="text-[11.5px] text-faint">
          마켓별 성공률·평균 소요·실패 유형 차트가 v2 에서 추가됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <p className="text-[11px] text-faint">자리만 비워두었습니다.</p>
      </CardContent>
    </Card>
  )
}

export default DashboardPage
