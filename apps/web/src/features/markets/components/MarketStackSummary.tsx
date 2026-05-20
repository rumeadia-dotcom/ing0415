import { MARKET_IDS, type MarketId } from '../types'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

// prototype data.js 출처 brand color (markets.md §7.2). 라이트/다크 공통.
const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

interface MarketStackSummaryProps {
  accounts: MarketAccount[]
}

/**
 * 5마켓 brand color 점 + "N/5 연결됨" 헤더.
 * markets.md §7.1 의 MarketStackSummary.
 *
 * - 연결된 마켓은 active 색상, 그렇지 않으면 grayscale (opacity).
 */
export function MarketStackSummary({ accounts }: MarketStackSummaryProps): JSX.Element {
  const activeMarkets = new Set(
    accounts.filter((a) => a.status === 'active' || a.status === 'expired' || a.status === 'error').map((a) => a.marketId),
  )
  const connectedCount = activeMarkets.size

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {MARKET_IDS.map((id) => (
          <span
            key={id}
            className="inline-block h-3 w-3 rounded-full"
            style={{
              backgroundColor: BRAND_COLOR[id],
              opacity: activeMarkets.has(id) ? 1 : 0.25,
            }}
          />
        ))}
      </div>
      <p className="text-sm text-text">
        <strong className="font-semibold">{connectedCount}</strong> / {MARKET_IDS.length} 마켓 연결됨
      </p>
    </div>
  )
}
