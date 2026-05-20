import { Link } from 'react-router-dom'
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import { formatRelativeTime } from '@/lib/format-time'
import type { RecentJob } from '@/lib/schemas/dashboard-summary'
import type { MarketId } from '@/lib/schemas/common'
import { MarketDotStack } from './MarketDotStack'

interface RecentJobsTableProps {
  state: 'loading' | 'data' | 'error' | 'empty'
  jobs: readonly RecentJob[]
  errorMessage?: string | undefined
}

const JOB_STATUS_LABEL: Record<RecentJob['job_status'], string> = {
  pending: '대기',
  running: '진행 중',
  partial: '일부 성공',
  succeeded: '성공',
  failed: '실패',
  retrying: '재시도',
  cancelled: '취소',
}

const JOB_STATUS_VARIANT: Record<
  RecentJob['job_status'],
  | 'status-pending'
  | 'status-running'
  | 'status-partial'
  | 'status-succeeded'
  | 'status-failed'
  | 'status-retrying'
  | 'status-cancelled'
> = {
  pending: 'status-pending',
  running: 'status-running',
  partial: 'status-partial',
  succeeded: 'status-succeeded',
  failed: 'status-failed',
  retrying: 'status-retrying',
  cancelled: 'status-cancelled',
}

export function RecentJobsTable({
  state,
  jobs,
  errorMessage,
}: RecentJobsTableProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle>최근 등록</CardTitle>
        <Link
          to="/history"
          className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          전체 보기 →
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {state === 'loading' ? (
          <div className="space-y-2 p-4" role="status" aria-live="polite" aria-label="최근 등록 불러오는 중">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : state === 'error' ? (
          <div className="p-6 text-sm text-danger" role="alert">
            {errorMessage ?? '최근 등록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
          </div>
        ) : state === 'empty' ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="text-sm text-text-secondary">아직 등록된 상품이 없어요.</p>
            <p className="text-xs text-text-tertiary">상품을 등록하면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((j) => {
              const marketIds: MarketId[] = j.markets.map((m) => m.market_id as MarketId)
              return (
                <li key={j.job_id}>
                  <Link
                    to={`/history/${j.job_id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Badge variant={JOB_STATUS_VARIANT[j.job_status]} size="sm">
                        {JOB_STATUS_LABEL[j.job_status]}
                      </Badge>
                      <span className="truncate text-sm text-text">
                        {j.success_count}/{j.market_total_count} 성공
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <MarketDotStack active={marketIds} size="sm" />
                      <span className="text-xs text-text-tertiary">
                        {formatRelativeTime(j.created_at)}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
