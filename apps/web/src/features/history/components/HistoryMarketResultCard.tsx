import { Badge, ErrorMessage } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import { formatRelativeTime } from '@/lib/format-time'
import type { JobMarketResult } from '@/lib/schemas/history-filter'

const STATUS_LABEL: Record<JobMarketResult['marketStatus'], string> = {
  pending: '대기',
  in_flight: '진행 중',
  success: '성공',
  failed: '실패 (재시도 가능)',
  failed_final: '최종 실패',
}

const STATUS_VARIANT: Record<
  JobMarketResult['marketStatus'],
  'default' | 'success' | 'warning' | 'danger' | 'info'
> = {
  pending: 'default',
  in_flight: 'info',
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

interface HistoryMarketResultCardProps {
  result: JobMarketResult
}

/**
 * 이력 상세의 마켓별 결과 카드.
 * - success: 외부 productUrl Link + externalProductId
 * - failed/failed_final: errorCode + ErrorMessage (errorMessage 접기/펼치기)
 * - excluded: 배지 명시
 * - attempt count + lastAttemptedAt 표시
 *
 * 재시도/제외 액션은 카드가 아닌 HistoryDetailHeader 의 actions slot 에서 일괄 처리.
 * 마스터: docs/architecture/v1/features/history.md §3.3 / n43.
 */
export function HistoryMarketResultCard({
  result,
}: HistoryMarketResultCardProps): JSX.Element {
  const marketId = result.marketId
  const label = MARKET_CATALOG[marketId].label
  const isFailed =
    result.marketStatus === 'failed' || result.marketStatus === 'failed_final'

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: BRAND_COLOR[marketId] }}
          />
          <span className="text-sm font-medium text-text">{label}</span>
          {result.excluded ? (
            <Badge variant="secondary" size="sm">
              제외됨
            </Badge>
          ) : null}
        </div>
        <Badge variant={STATUS_VARIANT[result.marketStatus]} size="md">
          {STATUS_LABEL[result.marketStatus]}
        </Badge>
      </div>

      {result.marketStatus === 'success' && result.productUrl ? (
        <div className="flex flex-col gap-1 text-sm">
          <a
            href={result.productUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline focus-visible:underline focus-visible:outline-none"
          >
            외부 상품 보기 ↗
          </a>
          {result.externalProductId ? (
            <span className="text-xs text-text-tertiary">
              외부 상품 ID: {result.externalProductId}
            </span>
          ) : null}
        </div>
      ) : null}

      {isFailed && (result.errorCode || result.errorMessage) ? (
        <ErrorMessage
          tone={result.marketStatus === 'failed_final' ? 'error' : 'warning'}
          message={
            result.errorCode
              ? `오류 코드: ${result.errorCode}`
              : '마켓 API 오류'
          }
          {...(result.errorMessage ? { details: result.errorMessage } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
        <span>시도 {result.attemptCount}회</span>
        {result.lastAttemptedAt ? (
          <span>최근 시도: {formatRelativeTime(result.lastAttemptedAt)}</span>
        ) : null}
        <span>갱신: {formatRelativeTime(result.updatedAt)}</span>
      </div>
    </article>
  )
}
