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
 * 데스크탑 테이블 행 — Studio s5 reference: studio-domains.jsx 의 accounts grid 5컬럼.
 *
 * grid: 40px (identity) · 1.4fr (마켓·인증방식) · 1fr (계정 mono) · 1fr (토큰 만료) · 110px (상태) · 120px (액션)
 */
export function MarketAccountRow({ account }: { account: MarketAccount }): JSX.Element {
  const entry = MARKET_CATALOG[account.marketId]
  const authLabel = AUTH_LABEL[entry.authMode] ?? entry.authMode
  const tt = ko.markets.table
  const verifiedLabel = account.lastVerifiedAt
    ? tt.verifiedAt(formatRelativeTime(account.lastVerifiedAt))
    : tt.verifyPending

  const expiryLabel =
    account.marketId === 'naver'
      ? tt.autoRefresh
      : account.status === 'expired'
        ? ko.markets.status.expired
        : tt.manualRefresh

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="py-3 pl-5 pr-2 align-middle">
        <MarketIdentity marketId={account.marketId} size="md" />
      </td>
      <td className="py-3 px-3 align-middle">
        <div className="text-sm font-semibold text-text">{entry.label}</div>
        <div className="mt-0.5 text-[11.5px] text-text-tertiary">
          {authLabel} · {verifiedLabel}
        </div>
      </td>
      <td className="py-3 px-3 align-middle">
        <span className="font-mono text-[13px] text-text">{account.accountLabel}</span>
      </td>
      <td className="py-3 px-3 align-middle">
        <span
          className={
            account.status === 'expired'
              ? 'text-[12.5px] font-semibold text-warning-on-soft'
              : 'text-[12.5px] text-text-secondary'
          }
        >
          {expiryLabel}
        </span>
      </td>
      <td className="py-3 px-3 align-middle">
        <MarketAccountStatusBadge status={account.status} />
      </td>
      <td className="py-3 pl-2 pr-5 text-right align-middle">
        <MarketAccountActions account={account} />
      </td>
    </tr>
  )
}
