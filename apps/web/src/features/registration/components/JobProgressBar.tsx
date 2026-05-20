import { Badge } from '@/components/ui'
import type { JobStatus, MarketResult } from '@/lib/schemas/registration'

interface JobProgressBarProps {
  status: JobStatus
  results: MarketResult[]
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: '대기',
  running: '진행 중',
  partial: '부분 성공',
  succeeded: '성공',
  failed: '실패',
  retrying: '재시도 중',
  cancelled: '취소됨',
}

const STATUS_VARIANT: Record<JobStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'default',
  running: 'default',
  partial: 'warning',
  succeeded: 'success',
  failed: 'danger',
  retrying: 'default',
  cancelled: 'default',
}

/**
 * 잡 상위 상태 + 마켓별 진행률 시각화.
 * 마스터: docs/architecture/v1/features/registration.md §10.7
 */
export function JobProgressBar({ status, results }: JobProgressBarProps): JSX.Element {
  const total = results.length
  const success = results.filter((r) => r.marketStatus === 'success').length
  const failed = results.filter((r) => r.marketStatus === 'failed' || r.marketStatus === 'failed_final').length
  const inFlight = results.filter((r) => r.marketStatus === 'in_flight' || r.marketStatus === 'pending').length
  const successPct = total > 0 ? (success / total) * 100 : 0
  const failedPct = total > 0 ? (failed / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">전체 상태</span>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-border" aria-label="진행률">
        <div className="flex h-full">
          <div className="bg-success transition-all" style={{ width: `${successPct}%` }} aria-label={`성공 ${success}`} />
          <div className="bg-danger transition-all" style={{ width: `${failedPct}%` }} aria-label={`실패 ${failed}`} />
        </div>
      </div>
      <p className="text-xs text-text-tertiary">
        총 {total}개 마켓 · 성공 {success} · 실패 {failed} · 진행 중 {inFlight}
      </p>
    </div>
  )
}
