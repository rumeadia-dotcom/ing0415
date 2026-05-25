import { Card, CardContent } from '@/components/ui'
import { ko } from '@/locales/ko'
import { MARKET_CATALOG } from '../types'
import { MarketAccountStatusBadge } from './MarketAccountStatusBadge'
import { MarketAccountActions } from './MarketAccountActions'
import { MarketIdentity } from './MarketIdentity'
import { formatRelativeTime } from '../utils/format-relative-time'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

const AUTH_LABEL: Record<string, string> = {
  oauth: 'OAuth 2.0',
  hmac: 'HMAC',
  esm_jwt: 'ESM JWT',
  api_key: 'API Key',
}

/**
 * 모바일 카드 — Studio s5 와이어 모바일.
 *
 * radius 14 padding 22 + header (identity + 마켓명 + status pill) + meta + actions footer.
 */
export function MarketAccountCard({ account }: { account: MarketAccount }): JSX.Element {
  const entry = MARKET_CATALOG[account.marketId]
  const authLabel = AUTH_LABEL[entry.authMode] ?? entry.authMode
  const verifiedLabel = account.lastVerifiedAt
    ? ko.markets.table.verifiedAt(formatRelativeTime(account.lastVerifiedAt))
    : ko.markets.table.verifyPending
  const expiryLabel =
    account.marketId === 'naver'
      ? ko.markets.table.autoRefresh
      : account.status === 'expired'
        ? ko.markets.status.expired
        : ko.markets.table.manualRefresh

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <MarketIdentity marketId={account.marketId} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-bold text-text">{entry.label}</h3>
              <MarketAccountStatusBadge status={account.status} />
            </div>
            <p className="mt-0.5 text-[12px] text-text-tertiary">
              {authLabel} · {verifiedLabel}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface-subtle p-3 text-sm">
          <div>
            <dt className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
              {ko.markets.table.colAccount}
            </dt>
            <dd className="mt-0.5 truncate font-mono text-[13px] font-semibold text-text">
              {account.accountLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
              {ko.markets.table.colExpiry}
            </dt>
            <dd
              className={
                account.status === 'expired'
                  ? 'mt-0.5 text-[13px] font-semibold text-warning-on-soft'
                  : 'mt-0.5 text-[13px] text-text-secondary'
              }
            >
              {expiryLabel}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex justify-end">
          <MarketAccountActions account={account} />
        </div>
      </CardContent>
    </Card>
  )
}
