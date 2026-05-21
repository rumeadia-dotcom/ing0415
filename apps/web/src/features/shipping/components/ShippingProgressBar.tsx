import { ShippingJobStatusBadge } from './ShippingJobStatusBadge'
import type {
  ShippingJob,
  ShippingJobMarketResult,
} from '../types/shipping-schema'

interface ShippingProgressBarProps {
  job: Pick<ShippingJob, 'status' | 'totalOrders'>
  results: readonly ShippingJobMarketResult[]
}

/**
 * n54 진행률 시각화 — 마켓별 성공/실패 비율 + 상위 상태 배지.
 * 마스터: 등록 도메인 JobProgressBar 패턴 재사용 (registration.md §10.7 와 동형).
 */
export function ShippingProgressBar({ job, results }: ShippingProgressBarProps): JSX.Element {
  const total = results.reduce((sum, r) => sum + r.totalOrders, 0)
  const success = results.reduce((sum, r) => sum + r.successOrders, 0)
  const failed = results.reduce((sum, r) => sum + r.failedOrders, 0)
  const inFlight = Math.max(total - success - failed, 0)

  const successPct = total > 0 ? (success / total) * 100 : 0
  const failedPct = total > 0 ? (failed / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">전체 상태</span>
        <ShippingJobStatusBadge status={job.status} />
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded bg-border"
        role="progressbar"
        aria-label="배송 잡 진행률"
        aria-valuenow={total > 0 ? Math.round(successPct + failedPct) : 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="flex h-full">
          <div
            className="bg-success transition-all"
            style={{ width: `${successPct}%` }}
            aria-label={`성공 ${success}`}
          />
          <div
            className="bg-danger transition-all"
            style={{ width: `${failedPct}%` }}
            aria-label={`실패 ${failed}`}
          />
        </div>
      </div>
      <p className="text-xs text-text-tertiary">
        총 {total}건 · 성공 {success} · 실패 {failed} · 진행 중 {inFlight}
      </p>
    </div>
  )
}
