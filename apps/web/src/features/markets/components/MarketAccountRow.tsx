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
 * 데스크탑 테이블 행 — markets.md §7.1 와이어.
 */
export function MarketAccountRow({ account }: { account: MarketAccount }): JSX.Element {
  const entry = MARKET_CATALOG[account.marketId]
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="py-3 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: BRAND_COLOR[account.marketId] }}
          />
          <span className="text-sm font-medium text-text">{entry.label}</span>
        </div>
      </td>
      <td className="py-3 px-2 text-sm text-text">{account.accountLabel}</td>
      <td className="py-3 px-2">
        <MarketAccountStatusBadge status={account.status} />
      </td>
      <td className="py-3 px-2 text-sm text-text-secondary">
        {account.lastVerifiedAt ? formatRelativeTime(account.lastVerifiedAt) : '확인 전'}
      </td>
      <td className="py-3 px-4 text-right">
        <MarketAccountActions account={account} />
      </td>
    </tr>
  )
}
