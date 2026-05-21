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

// Studio: 마켓 식별 'logo' variant (square + initial letter) — 카드/사이드바 권장.
const MARKET_INITIAL: Record<MarketId, string> = {
  naver: 'N',
  coupang: 'C',
  '11st': '11',
  gmarket: 'G',
  auction: 'A',
}

const MARKET_BG_CLASS: Record<MarketId, string> = {
  naver: 'bg-market-naver',
  coupang: 'bg-market-coupang',
  '11st': 'bg-market-eleventh',
  gmarket: 'bg-market-gmarket',
  auction: 'bg-market-auction',
}

interface HistoryMarketResultCardProps {
  result: JobMarketResult
}

/**
 * 이력 상세의 마켓별 결과 카드 — Studio 'logo' identity + 좌측 상태 컬러 바 (실패 시).
 * - success: 외부 productUrl Link + externalProductId mono
 * - failed/failed_final: errorCode + ErrorMessage (errorMessage 접기/펼치기) + 좌측 4px danger 바
 * - excluded: 배지 명시
 * - attempt count + lastAttemptedAt 표시
 *
 * 재시도/제외 액션은 카드가 아닌 HistoryDetailHeader 의 actions slot 에서 일괄 처리.
 * 마스터: docs/architecture/v1/features/history.md §3.3 / n43.
 * 디자인 ref: docs/design-renewal/designFile/concepts/studio-empty.jsx (s6 detail error card).
 */
export function HistoryMarketResultCard({
  result,
}: HistoryMarketResultCardProps): JSX.Element {
  const marketId = result.marketId
  const label = MARKET_CATALOG[marketId].label
  const isFailed =
    result.marketStatus === 'failed' || result.marketStatus === 'failed_final'
  const isFinal = result.marketStatus === 'failed_final'

  return (
    <article
      className={`relative overflow-hidden rounded-lg border border-border bg-surface ${
        isFailed ? 'pl-4' : ''
      }`}
    >
      {/* 실패 시 좌측 4px 상태 컬러 바 */}
      {isFailed ? (
        <span
          aria-hidden
          className={`absolute left-0 top-0 h-full w-1 ${
            isFinal ? 'bg-danger' : 'bg-warning'
          }`}
        />
      ) : null}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* 마켓 logo identity */}
            <span
              aria-hidden
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-white ${MARKET_BG_CLASS[marketId]}`}
            >
              {MARKET_INITIAL[marketId]}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text">{label}</span>
              <span className="font-mono text-[10.5px] text-text-tertiary">
                {marketId}
              </span>
            </div>
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
          <div className="flex flex-col gap-1 rounded-md border border-success/20 bg-success-soft px-3 py-2">
            <a
              href={result.productUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-success-on-soft hover:underline focus-visible:underline focus-visible:outline-none"
            >
              외부 상품 보기 ↗
            </a>
            {result.externalProductId ? (
              <span className="font-mono text-[11px] text-text-tertiary">
                ID: {result.externalProductId}
              </span>
            ) : null}
          </div>
        ) : null}

        {isFailed && (result.errorCode || result.errorMessage) ? (
          <ErrorMessage
            tone={isFinal ? 'error' : 'warning'}
            message={
              result.errorCode
                ? `오류 코드: ${result.errorCode}`
                : '마켓 API 오류'
            }
            {...(result.errorMessage ? { details: result.errorMessage } : {})}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-tertiary">
          <span>
            시도{' '}
            <span className="font-mono font-semibold tabular-nums">
              {result.attemptCount}
            </span>
            회
          </span>
          {result.lastAttemptedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>최근 시도: {formatRelativeTime(result.lastAttemptedAt)}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>갱신: {formatRelativeTime(result.updatedAt)}</span>
        </div>
      </div>
    </article>
  )
}
