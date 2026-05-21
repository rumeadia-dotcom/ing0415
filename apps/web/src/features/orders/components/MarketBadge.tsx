import { Badge } from '@/components/ui'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/lib/schemas/common'

/**
 * 마켓 한글명 배지 (s7 주문 컬럼/카드 공용).
 * v1 dashboard.MarketDotStack 의 brand color 와 매칭 — outline 으로 가시성 보장.
 */
const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

interface MarketBadgeProps {
  marketId: MarketId
  showDot?: boolean
}

export function MarketBadge({ marketId, showDot = true }: MarketBadgeProps): JSX.Element {
  return (
    <Badge variant="secondary" size="sm">
      {showDot ? (
        <span
          aria-hidden
          className="mr-1 inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: BRAND_COLOR[marketId] }}
        />
      ) : null}
      <span>{ko.market[marketId]}</span>
    </Badge>
  )
}
