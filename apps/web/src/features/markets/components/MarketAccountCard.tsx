import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { MARKET_CATALOG, type MarketId } from '../types'
import { MarketAccountStatusBadge } from './MarketAccountStatusBadge'
import { MarketAccountActions } from './MarketAccountActions'
import { formatRelativeTime } from '../utils/format-relative-time'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

/**
 * 모바일 카드 — markets.md §7.1 모바일 와이어.
 */
export function MarketAccountCard({ account }: { account: MarketAccount }): JSX.Element {
  const entry = MARKET_CATALOG[account.marketId]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: BRAND_COLOR[account.marketId] }}
          />
          <span>{entry.label}</span>
        </CardTitle>
        <p className="text-sm text-text">{account.accountLabel}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-sm">
          <MarketAccountStatusBadge status={account.status} />
          <span className="text-text-secondary">
            {account.lastVerifiedAt ? `${formatRelativeTime(account.lastVerifiedAt)} 확인` : '확인 전'}
          </span>
        </div>
        <MarketAccountActions account={account} />
      </CardContent>
    </Card>
  )
}
