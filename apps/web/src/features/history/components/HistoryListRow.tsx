import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { formatRelativeTime } from '@/lib/format-time'
import type { JobSummary } from '@/lib/schemas/history-filter'
import type { MarketId } from '@/lib/schemas/common'
import { MarketDotStack } from '@/features/dashboard/components/MarketDotStack'

const JOB_STATUS_LABEL: Record<JobSummary['status'], string> = {
  pending: '대기',
  running: '진행 중',
  partial: '일부 성공',
  succeeded: '성공',
  failed: '실패',
  retrying: '재시도',
  cancelled: '취소',
}

const JOB_STATUS_VARIANT: Record<
  JobSummary['status'],
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

interface HistoryListRowProps {
  job: JobSummary
  variant: 'table' | 'card'
}

/**
 * 이력 목록의 1행.
 * - 데스크탑: `<tr>` (HistoryListTable 의 `<table>` 안에서 사용)
 * - 모바일: `<Link>` 카드 (HistoryListTable 의 grid 안에서 사용)
 */
export function HistoryListRow({ job, variant }: HistoryListRowProps): JSX.Element {
  const marketIds: MarketId[] = job.marketSummary.map((m) => m.marketId)
  const successCount = job.marketSummary.filter(
    (m) => m.marketStatus === 'success',
  ).length
  const totalCount = job.marketSummary.length
  const time = formatRelativeTime(job.createdAt)
  const detailHref = `/history/${job.id}`

  if (variant === 'table') {
    return (
      <tr className="border-b border-border transition-colors hover:bg-surface-muted focus-within:bg-surface-muted">
        <td className="p-3">
          <Link
            to={detailHref}
            className="block truncate text-sm text-text hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {job.productName}
          </Link>
          {job.parentJobId ? (
            <div className="text-xs text-text-tertiary">재등록 잡</div>
          ) : null}
        </td>
        <td className="p-3">
          <Badge variant={JOB_STATUS_VARIANT[job.status]} size="sm">
            {JOB_STATUS_LABEL[job.status]}
          </Badge>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <MarketDotStack active={marketIds} size="sm" />
            <span className="text-xs text-text-secondary">
              {successCount}/{totalCount}
            </span>
          </div>
        </td>
        <td className="p-3 text-xs text-text-tertiary">{time}</td>
        <td className="p-3 text-xs text-text-tertiary">
          {job.retryCount > 0 ? `${job.retryCount}회 재시도` : '—'}
        </td>
      </tr>
    )
  }

  return (
    <Link
      to={detailHref}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text">{job.productName}</div>
          {job.parentJobId ? (
            <div className="text-xs text-text-tertiary">재등록 잡</div>
          ) : null}
        </div>
        <Badge variant={JOB_STATUS_VARIANT[job.status]} size="sm">
          {JOB_STATUS_LABEL[job.status]}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MarketDotStack active={marketIds} size="sm" />
          <span className="text-xs text-text-secondary">
            {successCount}/{totalCount} 성공
          </span>
        </div>
        <span className="text-xs text-text-tertiary">{time}</span>
      </div>
    </Link>
  )
}
