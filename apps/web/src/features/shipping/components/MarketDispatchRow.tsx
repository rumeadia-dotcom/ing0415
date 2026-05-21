import { Button, ErrorMessage } from '@/components/ui'
import { ko } from '@/locales/ko'
import { ShippingMarketResultBadge } from './ShippingJobStatusBadge'
import type { ShippingJobMarketResult } from '../types/shipping-schema'

interface MarketDispatchRowProps {
  result: ShippingJobMarketResult
  onRetry: (resultId: string) => void
  retrying: boolean
}

/**
 * n54 마켓별 진행 / n55 결과 표시. 실패 시 [재시도] 버튼 (n56).
 * - attempt_count ≥ 3 (failed_final) 이면 재시도 차단 + 사유 표시.
 */
export function MarketDispatchRow({
  result,
  onRetry,
  retrying,
}: MarketDispatchRowProps): JSX.Element {
  const marketLabel = ko.market[result.marketId]
  const isFinal = result.status === 'failed_final'
  const isFailed = result.status === 'failed'
  const canRetry = isFailed && !isFinal

  return (
    <li className="rounded border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">{marketLabel}</p>
          <p className="text-xs text-text-tertiary">
            총 {result.totalOrders}건 · 성공 {result.successOrders} · 실패 {result.failedOrders}
            {result.attemptCount > 0 ? ` · 시도 ${result.attemptCount}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShippingMarketResultBadge status={result.status} />
          {canRetry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRetry(result.id)}
              disabled={retrying}
            >
              재시도
            </Button>
          )}
        </div>
      </div>
      {result.errorMessage && (
        <div className="mt-2">
          <ErrorMessage message={result.errorMessage} />
        </div>
      )}
      {isFinal && (
        <p className="mt-1 text-xs text-text-tertiary">최대 시도 횟수 초과로 자동 재시도 불가</p>
      )}
    </li>
  )
}
