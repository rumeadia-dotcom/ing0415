import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  ErrorMessage,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/lib/schemas/common'
import type { MarketOrdersSummary } from '@/lib/schemas/dashboard-summary'
import { MarketOrderItemCard } from './MarketOrderItemCard'

interface MarketOrdersSummaryCardProps {
  state: 'loading' | 'data' | 'error' | 'empty'
  data?: MarketOrdersSummary | undefined
  errorMessage?: string | undefined
  /** 마켓 0건일 때 hero CTA 강조용 */
  hasNoConnectedMarkets?: boolean
}

/**
 * 마켓별 주문 현황 컨테이너 — s2 대시보드 위젯.
 * 마스터: docs/design-renewal/s2-dashboard.md §3.4 / §3.6 / §4.5 / §5.
 *
 * - 4 마켓 카드 (네이버 / 쿠팡 / G마켓 / 옥션) — 2×2 grid (모바일/데스크탑 동일)
 * - 하단: 11번가 placeholder (오픈 준비중)
 * - 우상단: "전체 보기" → /orders
 */
export function MarketOrdersSummaryCard({
  state,
  data,
  errorMessage,
  hasNoConnectedMarkets = false,
}: MarketOrdersSummaryCardProps): JSX.Element {
  return (
    <Card aria-labelledby="dashboard-market-orders-title">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2">
        <div>
          <CardTitle id="dashboard-market-orders-title" className="text-base">
            <ShoppingBag className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden />
            마켓별 주문 현황
          </CardTitle>
          <CardDescription>
            마켓별 신규 주문과 동기화 상태를 한눈에 확인하세요.
          </CardDescription>
        </div>
        <Link
          to="/orders"
          className="text-xs font-medium text-accent hover:underline"
          aria-label="주문 전체 보기"
        >
          전체 보기 →
        </Link>
      </CardHeader>
      <CardContent>
        {state === 'loading' && <LoadingGrid />}
        {state === 'error' && (
          <div role="alert">
            <ErrorMessage
              message="주문 현황을 불러오지 못했습니다"
              {...(errorMessage ? { details: errorMessage } : {})}
            />
          </div>
        )}
        {(state === 'data' || state === 'empty') && (
          <Grid data={data} hasNoConnectedMarkets={hasNoConnectedMarkets} />
        )}
      </CardContent>
    </Card>
  )
}

function LoadingGrid(): JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-label="마켓별 주문 현황 불러오는 중">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[112px] w-full" />
        ))}
      </div>
      <div className="mt-3">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

function Grid({
  data,
  hasNoConnectedMarkets,
}: {
  data: MarketOrdersSummary | undefined
  hasNoConnectedMarkets: boolean
}): JSX.Element {
  const markets = data?.markets ?? []
  const comingSoon = data?.comingSoon ?? []

  // empty 가이드 (마켓 0건 우선)
  const showConnectGuide = hasNoConnectedMarkets

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {markets.map((item) => (
          <MarketOrderItemCard key={item.marketId} item={item} />
        ))}
      </div>
      {comingSoon.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {comingSoon.map((marketId) => (
            <ComingSoonRow key={marketId} marketId={marketId} />
          ))}
        </div>
      )}
      {showConnectGuide && (
        <div className="rounded-md border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-text-secondary">
          아직 마켓 계정이 연결되지 않아 주문이 들어오지 않습니다.{' '}
          <Link to="/markets" className="font-medium text-accent hover:underline">
            마켓 연결하기 →
          </Link>
        </div>
      )}
    </div>
  )
}

function ComingSoonRow({ marketId }: { marketId: MarketId }): JSX.Element {
  const marketLabel = ko.market[marketId]
  return (
    <div
      data-market={marketId}
      className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-4 py-3 opacity-60"
      aria-label={`${marketLabel} 오픈 준비중`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full bg-text-tertiary"
        />
        <span className="text-sm font-medium text-text-secondary">{marketLabel}</span>
      </div>
      <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-text-tertiary">
        {ko.marketStatus.coming_soon}
      </span>
    </div>
  )
}
