import type { JobStatus, MarketResult } from '@/lib/schemas/registration'
import { cn } from '@/lib/utils'

interface JobProgressBarProps {
  status: JobStatus
  results: MarketResult[]
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: '대기',
  running: '진행 중',
  partial: '일부 성공',
  succeeded: '성공',
  failed: '실패',
  retrying: '재시도 중',
  cancelled: '취소됨',
}

const STATUS_TONE: Record<JobStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'neutral',
  running: 'neutral',
  partial: 'warning',
  succeeded: 'success',
  failed: 'danger',
  retrying: 'neutral',
  cancelled: 'neutral',
}

/**
 * 잡 상위 상태 + 마켓별 진행률 시각화 (Studio hero 룩).
 * 마스터: docs/architecture/v1/features/registration.md §10.7
 *
 * - 좌측: 큰 N/T + "마켓에 등록 완료"
 * - 우측: 전체 % + 라벨
 * - 하단: 성공/실패 segmented bar + 범례
 */
export function JobProgressBar({ status, results }: JobProgressBarProps): JSX.Element {
  const total = results.length
  const success = results.filter((r) => r.marketStatus === 'success').length
  const failed = results.filter(
    (r) => r.marketStatus === 'failed' || r.marketStatus === 'failed_final',
  ).length
  const inFlight = results.filter(
    (r) => r.marketStatus === 'in_flight' || r.marketStatus === 'pending',
  ).length
  const successPct = total > 0 ? (success / total) * 100 : 0
  const failedPct = total > 0 ? (failed / total) * 100 : 0
  const overallPct = Math.round(successPct)

  const tone = STATUS_TONE[status]

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[32px] font-bold leading-none tracking-tight text-text">
            {success} <span className="text-text-tertiary">/ {total}</span>
          </p>
          <p className="mt-1 text-[12.5px] text-text-tertiary">마켓에 등록 완료</p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'font-mono text-[20px] font-bold tracking-tight',
              tone === 'success' && 'text-success-on-soft',
              tone === 'warning' && 'text-warning-on-soft',
              tone === 'danger' && 'text-danger-on-soft',
              tone === 'neutral' && 'text-text',
            )}
          >
            {overallPct}%
          </p>
          <p className="mt-0.5 text-[11.5px] font-semibold text-text-tertiary">
            {STATUS_LABEL[status]}
          </p>
        </div>
      </div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-muted"
        aria-label="진행률"
      >
        <div
          className="h-full bg-success transition-all"
          style={{ width: `${successPct}%` }}
          aria-label={`성공 ${success}`}
        />
        <div
          className="h-full bg-danger transition-all"
          style={{ width: `${failedPct}%` }}
          aria-label={`실패 ${failed}`}
        />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden className="h-2 w-2 rounded-full bg-success" />
          성공 <span className="font-mono font-semibold">{success}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden className="h-2 w-2 rounded-full bg-danger" />
          실패 <span className="font-mono font-semibold">{failed}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden className="h-2 w-2 rounded-full bg-warning" />
          진행 중 <span className="font-mono font-semibold">{inFlight}</span>
        </span>
      </div>
    </div>
  )
}
