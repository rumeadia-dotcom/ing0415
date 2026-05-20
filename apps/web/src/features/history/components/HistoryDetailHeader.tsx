import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui'
import { formatRelativeTime, formatDurationSec } from '@/lib/format-time'
import type { JobDetail } from '@/lib/schemas/history-filter'

const JOB_STATUS_LABEL: Record<JobDetail['job']['status'], string> = {
  pending: '대기',
  running: '진행 중',
  partial: '일부 성공',
  succeeded: '성공',
  failed: '실패',
  retrying: '재시도',
  cancelled: '취소',
}

const JOB_STATUS_VARIANT: Record<
  JobDetail['job']['status'],
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

interface HistoryDetailHeaderProps {
  detail: JobDetail
  /** retry / exclude 버튼 등 액션 슬롯. partial / failed 잡에서만 활성화. */
  actions?: ReactNode
}

/**
 * 이력 상세 상단 헤더 — 잡 메타 + 부모/자식 잡 링크 + 액션 슬롯.
 * 마스터: docs/architecture/v1/features/history.md §3.3 / n43.
 */
export function HistoryDetailHeader({
  detail,
  actions,
}: HistoryDetailHeaderProps): JSX.Element {
  const { job, product, parent, children } = detail
  const duration =
    job.startedAt && job.completedAt
      ? Math.max(
          0,
          Math.floor(
            (new Date(job.completedAt).getTime() -
              new Date(job.startedAt).getTime()) /
              1000,
          ),
        )
      : null

  return (
    <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant={JOB_STATUS_VARIANT[job.status]} size="md">
              {JOB_STATUS_LABEL[job.status]}
            </Badge>
            {job.retryCount > 0 ? (
              <span className="text-xs text-text-tertiary">
                {job.retryCount}회 재시도
              </span>
            ) : null}
          </div>
          <h1 className="truncate text-h1 text-text">{product.name}</h1>
          <div className="mt-1 text-xs text-text-tertiary">
            생성: {formatRelativeTime(job.createdAt)}
            {job.completedAt ? (
              <>
                {' · '}완료: {formatRelativeTime(job.completedAt)}
              </>
            ) : null}
            {duration !== null ? (
              <>
                {' · '}소요: {formatDurationSec(duration)}
              </>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">
            {actions}
          </div>
        ) : null}
      </div>

      {(parent || children.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
          {parent ? (
            <Link
              to={`/history/${parent.id}`}
              className="text-accent hover:underline focus-visible:underline focus-visible:outline-none"
            >
              ← 부모 잡 보기 ({JOB_STATUS_LABEL[parent.status]})
            </Link>
          ) : null}
          {children.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">재등록 잡:</span>
              {children.map((c, i) => (
                <Link
                  key={c.id}
                  to={`/history/${c.id}`}
                  className="text-accent hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  #{i + 1} ({JOB_STATUS_LABEL[c.status]})
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {job.errorSummary ? (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-on-soft">
          {job.errorSummary}
        </div>
      ) : null}

      {job.cancelledAt && detail.cancelledByMaskedId ? (
        <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          취소: {formatRelativeTime(job.cancelledAt)} · 작업자{' '}
          {detail.cancelledByMaskedId}
        </div>
      ) : null}
    </header>
  )
}
