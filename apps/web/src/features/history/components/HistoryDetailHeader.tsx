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
 * 이력 상세 상단 헤더 — Studio 'hero' 패턴.
 * - 좌측: 썸네일 placeholder + jobId mono + 상태 pill (대형) + 상품명 (h1) + 메타 라인
 * - 우측: 액션 슬롯 (재시도 / 제외 후 재등록)
 *
 * 마스터: docs/architecture/v1/features/history.md §3.3 / n43.
 * 디자인 ref: docs/design-renewal/designFile/concepts/studio-empty.jsx (s6 detail).
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
  const shortId = `#${job.id.slice(0, 8).toUpperCase()}`

  return (
    <header className="rounded-lg border border-border bg-surface p-5 md:p-6">
      {/* breadcrumb */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-text-tertiary">
        <Link
          to="/history"
          className="hover:text-text focus-visible:underline focus-visible:outline-none"
        >
          등록 이력
        </Link>
        <span aria-hidden>›</span>
        <span className="font-mono font-semibold text-text">{shortId}</span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
        {/* product thumbnail placeholder — design intent: 마켓별 썸네일 보일 자리 */}
        <div
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted text-[10px] font-semibold uppercase tracking-wider text-text-tertiary md:h-[72px] md:w-[72px]"
        >
          PRODUCT
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant={JOB_STATUS_VARIANT[job.status]} size="md">
              {JOB_STATUS_LABEL[job.status]}
            </Badge>
            {job.retryCount > 0 ? (
              <span className="text-xs text-text-tertiary">
                재시도 {job.retryCount}회
              </span>
            ) : null}
          </div>
          <h1
            className="truncate text-h2 md:text-h1 text-text"
            title={product.name}
          >
            {product.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-text-tertiary">
            <span>생성 {formatRelativeTime(job.createdAt)}</span>
            {job.completedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>완료 {formatRelativeTime(job.completedAt)}</span>
              </>
            ) : null}
            {duration !== null ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatDurationSec(duration)} 소요</span>
              </>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-stretch md:gap-2 md:shrink-0">
            {actions}
          </div>
        ) : null}
      </div>

      {(parent || children.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
          {parent ? (
            <Link
              to={`/history/${parent.id}`}
              className="text-accent hover:underline focus-visible:underline focus-visible:outline-none"
            >
              ← 부모 잡 보기 ({JOB_STATUS_LABEL[parent.status]})
            </Link>
          ) : null}
          {children.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
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
        <div className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-on-soft">
          {job.errorSummary}
        </div>
      ) : null}

      {job.cancelledAt && detail.cancelledByMaskedId ? (
        <div className="mt-3 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
          취소: {formatRelativeTime(job.cancelledAt)} · 작업자{' '}
          {detail.cancelledByMaskedId}
        </div>
      ) : null}
    </header>
  )
}
