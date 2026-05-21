import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/lib/schemas/common'

/**
 * 마켓 아이덴티티 배지 (s7/s8 공용).
 *
 * Studio 룩 — 좌측 컬러 사각 dot + 한글 라벨. tailwind market-{id} 토큰 사용 (raw HEX 금지).
 * 색상에만 의존하지 않도록 한글 라벨 동반 (WCAG 2.1 AA).
 */

const DOT_CLASS: Record<MarketId, string> = {
  naver: 'bg-market-naver',
  coupang: 'bg-market-coupang',
  gmarket: 'bg-market-gmarket',
  auction: 'bg-market-auction',
  '11st': 'bg-market-naver', // v1 미진입. fallback.
}

interface MarketBadgeProps {
  marketId: MarketId
  showDot?: boolean
  size?: 'sm' | 'md'
  variant?: 'pill' | 'plain'
  className?: string
}

export function MarketBadge({
  marketId,
  showDot = true,
  size = 'sm',
  variant = 'pill',
  className,
}: MarketBadgeProps): JSX.Element {
  if (variant === 'plain') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-text-secondary',
          className,
        )}
      >
        {showDot ? (
          <span
            aria-hidden
            className={cn('inline-block h-2 w-2 rounded-sm', DOT_CLASS[marketId])}
          />
        ) : null}
        <span>{ko.market[marketId]}</span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        'font-semibold text-text',
        className,
      )}
    >
      {showDot ? (
        <span
          aria-hidden
          className={cn(
            'inline-block rounded-sm',
            size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
            DOT_CLASS[marketId],
          )}
        />
      ) : null}
      <span>{ko.market[marketId]}</span>
    </span>
  )
}
