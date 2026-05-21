import { RefreshCcw } from 'lucide-react'
import { Button, ErrorMessage } from '@/components/ui'
import { MarketBadge } from '@/features/orders/components/MarketBadge'
import { ShippingMarketResultBadge } from './ShippingJobStatusBadge'
import type { ShippingJobMarketResult } from '../types/shipping-schema'

interface MarketDispatchRowProps {
  result: ShippingJobMarketResult
  onRetry: (resultId: string) => void
  retrying: boolean
}

/**
 * n54 마켓별 진행 / n55 결과 표시. 실패 시 [재시도] 버튼 (n56).
 *
 * Studio 룩: 좌측 MarketBadge + 라벨, 우측 상태 pill + 재시도 ghost 버튼.
 * - attempt_count ≥ 3 (failed_final) 이면 재시도 차단 + 사유 표시.
 */
export function MarketDispatchRow({
  result,
  onRetry,
  retrying,
}: MarketDispatchRowProps): JSX.Element {
  const isFinal = result.status === 'failed_final'
  const isFailed = result.status === 'failed'
  const canRetry = isFailed && !isFinal

  return (
    <li className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MarketBadge marketId={result.marketId} size="md" />
          <p className="text-[11.5px] text-text-tertiary">
            총{' '}
            <span className="font-mono font-semibold text-text">
              {result.totalOrders}
            </span>{' '}
            · 성공{' '}
            <span className="font-mono font-semibold text-success-on-soft">
              {result.successOrders}
            </span>{' '}
            · 실패{' '}
            <span className="font-mono font-semibold text-danger-on-soft">
              {result.failedOrders}
            </span>
            {result.attemptCount > 0 ? (
              <>
                {' '}· 시도{' '}
                <span className="font-mono font-semibold text-text">
                  {result.attemptCount}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShippingMarketResultBadge status={result.status} />
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry(result.id)}
              disabled={retrying}
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
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
        <p className="mt-1 text-[11px] text-text-tertiary">
          최대 시도 횟수 초과로 자동 재시도 불가
        </p>
      )}
    </li>
  )
}
