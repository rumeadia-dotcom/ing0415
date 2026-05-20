import { Badge, Button } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { MarketResult, MarketResultStatus } from '@/lib/schemas/registration'

interface JobMarketResultRowProps {
  result: MarketResult
  onRetry?: (resultId: string) => void
  retrying?: boolean
}

const STATUS_LABEL: Record<MarketResultStatus, string> = {
  pending: '대기',
  in_flight: '진행 중',
  success: '성공',
  failed: '실패 (재시도 가능)',
  failed_final: '최종 실패',
}

const STATUS_VARIANT: Record<MarketResultStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'default',
  in_flight: 'default',
  success: 'success',
  failed: 'warning',
  failed_final: 'danger',
}

const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

/**
 * 마켓별 결과 1행 — success URL / failed code + retry CTA.
 * 마스터: docs/architecture/v1/features/registration.md §10.7
 */
export function JobMarketResultRow({ result, onRetry, retrying }: JobMarketResultRowProps): JSX.Element {
  const marketId = result.marketId as MarketId
  const label = MARKET_CATALOG[marketId].label
  const canRetry = result.marketStatus === 'failed' && !result.excluded

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center gap-3">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRAND_COLOR[marketId] }} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text">{label}</span>
          {result.marketStatus === 'success' && result.productUrl && (
            <a
              href={result.productUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-accent hover:underline"
            >
              외부 상품 보기 ↗
            </a>
          )}
          {(result.marketStatus === 'failed' || result.marketStatus === 'failed_final') && result.errorCode && (
            <span className="text-xs text-text-secondary">오류 코드: {result.errorCode}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[result.marketStatus]}>{STATUS_LABEL[result.marketStatus]}</Badge>
        {canRetry && onRetry && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRetry(result.id)}
            disabled={retrying}
          >
            {retrying ? '재시도 중…' : '재시도'}
          </Button>
        )}
      </div>
    </li>
  )
}
