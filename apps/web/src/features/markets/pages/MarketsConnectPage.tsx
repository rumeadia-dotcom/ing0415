import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui'
import { ko } from '@/locales/ko'
import { MARKET_IDS, MARKET_CATALOG, type MarketId } from '../types'
import { MarketIdentity } from '../components/MarketIdentity'

/**
 * MarketsConnectPage — n36 진입 (마켓 선택 → 4-way 인증 분기).
 *
 * Studio s5 reference: 5마켓 카드 그리드 (m1-m5) + per-market 인증방식 힌트 + ready CTA.
 *
 *  - v1 활성 5개 (naver / coupang / gmarket / auction / 11st) — clickable Link card
 *  - 11번가 = status='ready' = API Key 폼으로 연결
 */
export function MarketsConnectPage(): JSX.Element {
  const t = ko.markets.connect

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <Breadcrumb />
      <PageHeader title={t.pageTitle} subtitle={t.pageSubtitle} />

      <div className="grid gap-3 sm:grid-cols-2">
        {MARKET_IDS.map((id) => (
          <MarketSelectCard key={id} marketId={id} />
        ))}
      </div>
    </div>
  )
}

function Breadcrumb(): JSX.Element {
  return (
    <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-text-tertiary">
      <Link to="/markets" className="hover:text-text">
        {ko.markets.connect.breadcrumb.markets}
      </Link>
      <span aria-hidden>›</span>
      <span className="font-semibold text-text">{ko.markets.connect.breadcrumb.new}</span>
    </nav>
  )
}

function MarketSelectCard({ marketId }: { marketId: MarketId }): JSX.Element {
  const entry = MARKET_CATALOG[marketId]
  const isReady = entry.status === 'ready'
  const t = ko.markets.connect
  const authHint = t.authHint[entry.authMode]

  const inner = (
    <Card
      className={
        isReady
          ? 'group h-full transition-colors hover:border-accent hover:bg-accent-soft/40'
          : 'h-full opacity-60'
      }
    >
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <MarketIdentity marketId={marketId} size="lg" />
          <div className="flex-1">
            <div className="text-base font-bold text-text">{entry.label}</div>
            <p className="mt-0.5 text-[12px] text-text-tertiary">{authHint}</p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-end pt-2">
          {isReady ? (
            <span className="text-sm font-semibold text-accent group-hover:underline">
              {t.cardCta}
            </span>
          ) : (
            <span className="rounded-md bg-surface-subtle px-2 py-1 text-[11px] font-semibold text-text-tertiary">
              {t.cardCtaDisabled}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (!isReady) {
    return (
      <div
        aria-disabled
        role="group"
        aria-label={`${entry.label} ${t.cardCtaDisabled}`}
        className="cursor-not-allowed"
      >
        {inner}
      </div>
    )
  }
  return (
    <Link
      to={`/markets/connect/${marketId}`}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {inner}
    </Link>
  )
}

export default MarketsConnectPage
