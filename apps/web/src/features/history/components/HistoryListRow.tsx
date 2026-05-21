import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { formatRelativeTime } from '@/lib/format-time'
import type { JobSummary } from '@/lib/schemas/history-filter'
import type { MarketId } from '@/lib/schemas/common'
import { MarketDotStack } from '@/features/dashboard/components/MarketDotStack'
import { MarketBarStack } from './MarketBarStack'

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

// Studio: 잡 상태별 좌측 4px 컬러 바 (statusMap.fg 대응)
const STATUS_BAR_CLASS: Record<JobSummary['status'], string> = {
  pending: 'bg-text-tertiary/60',
  running: 'bg-info-on-soft',
  partial: 'bg-warning',
  succeeded: 'bg-success',
  failed: 'bg-danger',
  retrying: 'bg-warning',
  cancelled: 'bg-text-tertiary/60',
}

interface HistoryListRowProps {
  job: JobSummary
  variant: 'table' | 'card'
}

/**
 * 이력 목록의 1행.
 * - 데스크탑: `<tr>` (HistoryListTable 의 `<table>` 안에서 사용) — Studio 'bar' identity (좌측 4px 컬러 바 + 마켓 바 스택).
 * - 모바일: `<Link>` 카드 — 마켓 dot stack 유지 (저밀도).
 */
export function HistoryListRow({ job, variant }: HistoryListRowProps): JSX.Element {
  const marketIds: MarketId[] = job.marketSummary.map((m) => m.marketId)
  const successCount = job.marketSummary.filter(
    (m) => m.marketStatus === 'success',
  ).length
  const failedCount = job.marketSummary.filter(
    (m) => m.marketStatus === 'failed' || m.marketStatus === 'failed_final',
  ).length
  const totalCount = job.marketSummary.length
  const time = formatRelativeTime(job.createdAt)
  const detailHref = `/history/${job.id}`
  const shortId = `#${job.id.slice(0, 8).toUpperCase()}`

  if (variant === 'table') {
    return (
      <tr className="group border-b border-border last:border-b-0 transition-colors hover:bg-surface-muted focus-within:bg-surface-muted">
        {/* 좌측 3px 상태 컬러 바 — Studio bar identity for tables */}
        <td className={`w-[3px] p-0 ${STATUS_BAR_CLASS[job.status]}`} aria-hidden />
        <td className="px-3 py-3.5 align-middle">
          <span className="font-mono text-[11.5px] font-medium text-text-secondary">
            {shortId}
          </span>
        </td>
        <td className="min-w-0 px-3 py-3.5 align-middle">
          <Link
            to={detailHref}
            className="block truncate text-sm font-medium text-text hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            title={job.productName}
          >
            {job.productName}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-tertiary">
            <MarketBarStack active={marketIds} />
            {successCount > 0 ? (
              <span className="text-success-on-soft font-semibold">
                {successCount}성공
              </span>
            ) : null}
            {failedCount > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-danger-on-soft font-semibold">
                  {failedCount}실패
                </span>
              </>
            ) : null}
            {job.parentJobId ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-accent font-semibold">재등록 잡</span>
              </>
            ) : null}
          </div>
        </td>
        <td className="px-3 py-3.5 align-middle">
          <Badge variant={JOB_STATUS_VARIANT[job.status]} size="sm">
            {JOB_STATUS_LABEL[job.status]}
          </Badge>
        </td>
        <td className="px-3 py-3.5 align-middle text-right text-xs text-text-tertiary tabular-nums">
          <span className="font-mono">{time}</span>
        </td>
        <td className="px-3 py-3.5 align-middle text-right text-xs text-text-tertiary">
          {job.retryCount > 0 ? (
            <span className="tabular-nums">{job.retryCount}회</span>
          ) : (
            <span aria-hidden>—</span>
          )}
        </td>
        <td className="w-7 px-2 py-3.5 align-middle text-right text-text-tertiary">
          <Link
            to={detailHref}
            aria-label={`${job.productName} 상세 보기`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-base leading-none hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden>›</span>
          </Link>
        </td>
      </tr>
    )
  }

  return (
    <Link
      to={detailHref}
      className={`block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1 inline-block h-10 w-[3px] rounded-sm ${STATUS_BAR_CLASS[job.status]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-text-tertiary">
              {shortId}
            </span>
            <Badge variant={JOB_STATUS_VARIANT[job.status]} size="sm">
              {JOB_STATUS_LABEL[job.status]}
            </Badge>
          </div>
          <div className="mt-1 truncate text-sm font-medium text-text" title={job.productName}>
            {job.productName}
          </div>
          {job.parentJobId ? (
            <div className="mt-0.5 text-xs text-text-tertiary">재등록 잡</div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MarketDotStack active={marketIds} size="sm" />
              <span className="text-xs text-text-secondary tabular-nums">
                {successCount}/{totalCount} 성공
              </span>
            </div>
            <span className="font-mono text-xs text-text-tertiary">{time}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
