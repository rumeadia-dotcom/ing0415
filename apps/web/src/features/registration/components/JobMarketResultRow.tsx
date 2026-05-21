import { ExternalLink, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { MarketResult, MarketResultStatus } from '@/lib/schemas/registration'
import { cn } from '@/lib/utils'

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

const STATUS_TONE: Record<MarketResultStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'neutral',
  in_flight: 'neutral',
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
 * 마켓별 결과 1행 — success URL / failed code + retry CTA. Studio 룩 (좌측 accent stripe).
 * 마스터: docs/architecture/v1/features/registration.md §10.7
 */
export function JobMarketResultRow({
  result,
  onRetry,
  retrying,
}: JobMarketResultRowProps): JSX.Element {
  const marketId = result.marketId as MarketId
  const label = MARKET_CATALOG[marketId].label
  const isSuccess = result.marketStatus === 'success'
  const isFinalFail = result.marketStatus === 'failed_final'
  const canRetry = result.marketStatus === 'failed' && !result.excluded
  const tone = STATUS_TONE[result.marketStatus]

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-surface p-3 md:flex-row md:items-center md:gap-4',
        isSuccess && 'border-success/30',
        isFinalFail && 'border-danger/30',
        !isSuccess && !isFinalFail && 'border-border',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'hidden h-12 w-1 shrink-0 rounded-full md:block',
          isSuccess && 'bg-success',
          isFinalFail && 'bg-danger',
          !isSuccess && !isFinalFail && 'bg-warning',
        )}
      />
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: BRAND_COLOR[marketId] }}
      >
        {label.slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-text">{label}</p>
        {isSuccess && result.productUrl ? (
          <a
            href={result.productUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            외부 상품 보기
            {result.externalProductId && (
              <span className="ml-1 font-mono text-text-tertiary">· {result.externalProductId}</span>
            )}
          </a>
        ) : null}
        {!isSuccess && result.errorCode && (
          <p
            className={cn(
              'mt-0.5 text-[11.5px] font-medium',
              isFinalFail ? 'text-danger-on-soft' : 'text-warning-on-soft',
            )}
          >
            오류 코드: <span className="font-mono">{result.errorCode}</span>
          </p>
        )}
      </div>
      <span className="font-mono text-[11.5px] text-text-tertiary md:min-w-[120px]">
        {result.externalProductId ?? '—'}
      </span>
      <StatusPill tone={tone} label={STATUS_LABEL[result.marketStatus]} />
      <span className="font-mono text-[11.5px] text-text-tertiary">
        {result.attemptCount}/3
      </span>
      <div className="md:min-w-[110px] md:text-right">
        {canRetry && onRetry && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRetry(result.id)}
            disabled={retrying}
          >
            <RotateCw className={cn('h-3 w-3', retrying && 'animate-spin')} aria-hidden />
            {retrying ? '재시도 중…' : '재시도'}
          </Button>
        )}
        {isFinalFail && (
          <span className="inline-flex items-center rounded-md border border-border bg-surface-muted px-2.5 py-1.5 text-[11.5px] font-semibold text-text-tertiary">
            수정 필요
          </span>
        )}
      </div>
    </li>
  )
}

function StatusPill({
  tone,
  label,
}: {
  tone: 'neutral' | 'success' | 'warning' | 'danger'
  label: string
}): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold md:min-w-[100px] md:justify-center',
        tone === 'success' && 'bg-success-soft text-success-on-soft',
        tone === 'warning' && 'bg-warning-soft text-warning-on-soft',
        tone === 'danger' && 'bg-danger-soft text-danger-on-soft',
        tone === 'neutral' && 'bg-surface-muted text-text-secondary',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'success' && 'bg-success',
          tone === 'warning' && 'bg-warning',
          tone === 'danger' && 'bg-danger',
          tone === 'neutral' && 'bg-text-tertiary',
        )}
      />
      {label}
    </span>
  )
}
