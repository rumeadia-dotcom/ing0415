import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui'
import { ko } from '@/locales/ko'
import { MARKET_CATALOG, type MarketId, type MarketAuthMode } from '../types'
import { MarketIdentity } from './MarketIdentity'

interface ProviderConnectShellProps {
  marketId: MarketId
  authMode: MarketAuthMode
  form: ReactNode
  aside?: ReactNode
}

/**
 * 4-way 마켓 연결 폼의 공통 레이아웃 — Studio s5 connect (studio-extras.jsx StudioMarketConnect).
 *
 * - breadcrumb (마켓 계정 › 신규 연결 › 마켓라벨)
 * - 카드 헤더 (Identity 로고 + 라벨 + 인증방식 안내 + 발급 가이드 링크)
 * - 좌: form / 우: aside (가이드 + 보안 주의)
 */
export function ProviderConnectShell({
  marketId,
  authMode,
  form,
  aside,
}: ProviderConnectShellProps): JSX.Element {
  const entry = MARKET_CATALOG[marketId]
  const label = entry.label
  const t = ko.markets

  return (
    <div className="mx-auto w-full max-w-[960px]">
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="mb-3 flex items-center gap-1.5 text-xs text-text-tertiary"
      >
        <Link to="/markets" className="hover:text-text">
          {t.connect.breadcrumb.markets}
        </Link>
        <span aria-hidden>›</span>
        <Link to="/markets/connect" className="hover:text-text">
          {t.connect.breadcrumb.new}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-text">{label}</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Form column */}
        <Card>
          <CardContent className="p-6">
            {/* Header row — Identity + label + auth hint + guide link */}
            <div className="mb-5 flex items-center gap-3">
              <MarketIdentity marketId={marketId} size="lg" />
              <div className="flex-1">
                <h2 className="text-lg font-bold tracking-tight text-text">
                  {t.form.sectionHeading(label)}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-text-tertiary">
                  {t.form.sectionHint[authMode]}
                </p>
              </div>
              <span className="hidden text-[11.5px] font-bold text-accent sm:inline">
                {t.form.issuanceGuide}
              </span>
            </div>

            {form}
          </CardContent>
        </Card>

        {/* Aside column */}
        {aside ? <aside className="flex flex-col gap-4">{aside}</aside> : null}
      </div>
    </div>
  )
}
