import { Link } from 'react-router-dom'
import { PackagePlus, Clock, CheckCircle2, Timer } from 'lucide-react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useRecentJobs } from '../hooks/useRecentJobs'
import { useMarketHealth } from '../hooks/useMarketHealth'
import { SummaryCard } from '../components/SummaryCard'
import { RecentJobsTable } from '../components/RecentJobsTable'
import { MarketHealthCard } from '../components/MarketHealthCard'
import { DashboardEmptyState } from '../components/DashboardEmptyState'
import { formatDurationSec } from '@/lib/format-time'

/**
 * DashboardPage — s2 (n9~n14, v1).
 * 마스터: docs/architecture/v1/features/dashboard.md.
 *
 * 레이아웃 (desktop):
 *   PageHeader
 *   ─ Summary cards row (4)
 *   ─ Empty state OR 2-column (RecentJobs 좌, MarketHealth + v2 placeholder 우)
 *
 * 4상태 + partial 시각화는 각 자식 컴포넌트가 책임.
 */
export function DashboardPage(): JSX.Element {
  const summary = useDashboardSummary()
  const recent = useRecentJobs(20)
  const health = useMarketHealth()

  const isEmpty = summary.data?.last_job_at === null

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="대시보드"
        subtitle="등록 현황과 최근 작업을 한눈에 확인하세요"
        actions={
          <Button asChild>
            <Link to="/register">
              <PackagePlus className="mr-2 h-4 w-4" aria-hidden />
              상품 등록
            </Link>
          </Button>
        }
      />

      <SummaryGrid summary={summary} />

      {isEmpty ? (
        <div className="mt-6">
          <DashboardEmptyState />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentJobsTable
              state={
                recent.isLoading
                  ? 'loading'
                  : recent.isError
                    ? 'error'
                    : !recent.data || recent.data.length === 0
                      ? 'empty'
                      : 'data'
              }
              jobs={recent.data ?? []}
              errorMessage={recent.error?.message}
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
        icon={<PackagePlus className="h-4 w-4" aria-hidden />}
      />
      <SummaryCard
        label="진행 중"
        value={`${data?.jobs_in_progress_count ?? 0}건`}
        state={baseState}
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
        icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
      />
      <SummaryCard
        label="평균 소요 (7일)"
        value={data && data.avg_duration_sec_7d > 0 ? formatDurationSec(data.avg_duration_sec_7d) : '—'}
        hint="성공 잡 기준"
        state={baseState}
        icon={<Timer className="h-4 w-4" aria-hidden />}
      />
    </div>
  )
}

function V2PlaceholderCard(): JSX.Element {
  return (
    <Card data-feature="market-stats-v2" className="opacity-60">
      <CardHeader>
        <CardTitle className="text-base">마켓별 통계 — v2</CardTitle>
        <CardDescription>
          마켓별 성공률·평균 소요·실패 유형 차트가 v2 에서 추가됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-text-tertiary">자리만 비워두었습니다.</p>
      </CardContent>
    </Card>
  )
}

export default DashboardPage
