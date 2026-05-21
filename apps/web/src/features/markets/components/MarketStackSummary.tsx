import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { ko } from '@/locales/ko'
import { MARKET_IDS, MARKET_CATALOG, type MarketId } from '../types'
import { MarketIdentity } from './MarketIdentity'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

interface MarketStackSummaryProps {
  accounts: MarketAccount[]
}

/**
 * 마켓 계정 페이지 상단 요약 스트립.
 * Studio s5 reference: studio-domains.jsx StudioMarkets — 좌 "N/4" + 가운데 마켓 identity 행 + 우 신규 연결 CTA.
 *
 * 활성/만료/오류/v2예정 카운터를 함께 노출하여 한 눈에 상태 파악 가능.
 * - "활성"의 base 는 v1 정식 마켓 4 (네이버/쿠팡/G마켓/옥션). 11번가는 v2 카운트로 분리.
 */
export function MarketStackSummary({ accounts }: MarketStackSummaryProps): JSX.Element {
  const t = ko.markets.summary
  const READY_MARKETS = MARKET_IDS.filter((id) => MARKET_CATALOG[id].status === 'ready')
  const COMING_SOON_MARKETS = MARKET_IDS.filter(
    (id) => MARKET_CATALOG[id].status === 'coming_soon',
  )

  const activeMarketIds = new Set<MarketId>(
    accounts.filter((a) => a.status === 'active').map((a) => a.marketId),
  )
  const expiringIds = new Set<MarketId>(
    accounts.filter((a) => a.status === 'expired').map((a) => a.marketId),
  )
  const errorIds = new Set<MarketId>(
    accounts.filter((a) => a.status === 'error').map((a) => a.marketId),
  )

  return (
    <section
      aria-label={t.countersAria}
      className="mb-4 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface px-5 py-4 lg:grid-cols-[auto,1fr,auto] lg:items-center lg:gap-6"
    >
      {/* 좌: N/4 */}
      <div>
        <div className="text-xs font-semibold text-text-tertiary">{t.connectedHeading}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold leading-none tracking-tight text-text">
            {activeMarketIds.size}
          </span>
          <span className="text-sm font-semibold text-text-tertiary">
            / {READY_MARKETS.length}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium">
          {activeMarketIds.size > 0 && (
            <span className="text-success-on-soft">{t.activeCount(activeMarketIds.size)}</span>
          )}
          {expiringIds.size > 0 && (
            <span className="text-warning-on-soft">{t.expiringCount(expiringIds.size)}</span>
          )}
          {errorIds.size > 0 && (
            <span className="text-danger-on-soft">{t.errorCount(errorIds.size)}</span>
          )}
          {COMING_SOON_MARKETS.length > 0 && (
            <span className="text-text-tertiary">
              {t.comingSoonCount(COMING_SOON_MARKETS.length)}
            </span>
          )}
        </div>
      </div>

      {/* 중앙: 마켓 identity 행 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {MARKET_IDS.map((id) => {
          const entry = MARKET_CATALOG[id]
          const isActive = activeMarketIds.has(id)
          const isComingSoon = entry.status === 'coming_soon'
          return (
            <div
              key={id}
              className={
                isComingSoon
                  ? 'flex items-center gap-2 opacity-50'
                  : isActive
                    ? 'flex items-center gap-2'
                    : 'flex items-center gap-2 opacity-60'
              }
            >
              <MarketIdentity marketId={id} size="md" />
              <span className="text-xs font-semibold text-text">{entry.label}</span>
            </div>
          )
        })}
      </div>

      {/* 우: 새 연결 CTA */}
      <div className="lg:justify-self-end">
        <Button asChild variant="primary">
          <Link to="/markets/connect">{ko.markets.page.newConnect}</Link>
        </Button>
      </div>
    </section>
  )
}
