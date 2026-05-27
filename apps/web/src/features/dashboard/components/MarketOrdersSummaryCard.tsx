import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  ErrorMessage,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/lib/schemas/common'
import type { MarketOrdersSummary } from '@/lib/schemas/dashboard-summary'
import { MarketOrderItemCard } from './MarketOrderItemCard'
import { MarketLogo } from './MarketLogo'

interface MarketOrdersSummaryCardProps {
  state: 'loading' | 'data' | 'error' | 'empty'
  data?: MarketOrdersSummary | undefined
  errorMessage?: string | undefined
  /** 마켓 0건일 때 hero CTA 강조용 */
  hasNoConnectedMarkets?: boolean
}

/**
 * 마켓별 주문 현황 컨테이너 — s2 대시보드 위젯.
 * 마스터: docs/design-renewal/s2-dashboard.md §3.4 / §3.6 / §4.5 / §5
 * 디자인: docs/design-renewal/designFile/concepts/studio.jsx — "마켓 연결" 패턴
 *
 * Studio 룩:
 *   - 헤더: H2 14 ink + sub 11.5 faint
 *   - body: 마켓 row 세로 stack (logo + 마켓명 + 신규/오늘 mini stats + sync badge)
 *   - 하단: comingSoon 마켓 placeholder (현재 5마켓 전부 ready 라 빈 배열 — 행 미노출)
 *   - 우상단: "전체 보기" → /orders
 */
export function MarketOrdersSummaryCard({
  state,
  data,
  errorMessage,
  hasNoConnectedMarkets = false,
}: MarketOrdersSummaryCardProps): JSX.Element {
  return (
    <Card
      aria-labelledby="dashboard-market-orders-title"
      className="rounded-[14px] border-border"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 px-[18px] py-4">
        <div className="flex items-center gap-2">
          <ShoppingBag
            className="h-4 w-4 text-accent"
            aria-hidden
          />
          <div>
            <CardTitle
              as="h2"
              id="dashboard-market-orders-title"
              className="text-[14px] font-bold leading-none text-ink"
            >
              마켓별 주문 현황
            </CardTitle>
            <p className="mt-1.5 text-[11.5px] text-faint">
              마켓별 신규 주문과 동기화 상태를 한눈에 확인하세요
            </p>
          </div>
        </div>
        <Link
          to="/orders"
          className="text-[11.5px] font-semibold text-dim hover:text-ink"
          aria-label="주문 전체 보기"
        >
          전체 보기 →
        </Link>
      </CardHeader>
      <CardContent className="px-[18px] pb-[18px] pt-0">
        {state === 'loading' && <LoadingList />}
        {state === 'error' && (
          <div role="alert">
            <ErrorMessage
              message="주문 현황을 불러오지 못했습니다"
              {...(errorMessage ? { details: errorMessage } : {})}
            />
          </div>
        )}
        {(state === 'data' || state === 'empty') && (
          <List data={data} hasNoConnectedMarkets={hasNoConnectedMarkets} />
        )}
      </CardContent>
    </Card>
  )
}

function LoadingList(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="마켓별 주문 현황 불러오는 중"
      className="space-y-2"
    >
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
      ))}
      <Skeleton className="h-10 w-full rounded-[10px]" />
    </div>
  )
}

function List({
  data,
  hasNoConnectedMarkets,
}: {
  data: MarketOrdersSummary | undefined
  hasNoConnectedMarkets: boolean
}): JSX.Element {
  const markets = data?.markets ?? []
  const comingSoon = data?.comingSoon ?? []

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2">
        {markets.map((item) => (
          <MarketOrderItemCard key={item.marketId} item={item} />
        ))}
      </div>
      {comingSoon.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          {comingSoon.map((marketId) => (
            <ComingSoonRow key={marketId} marketId={marketId} />
          ))}
        </div>
      )}
      {hasNoConnectedMarkets && (
        <div className="rounded-[10px] border border-dashed border-border-strong bg-card-2 px-4 py-3 text-[12.5px] text-dim">
          아직 마켓 계정이 연결되지 않아 주문이 들어오지 않습니다.{' '}
          <Link
            to="/markets"
            className="font-semibold text-accent hover:underline"
          >
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
      className="flex items-center gap-3 rounded-[10px] border border-dashed border-border-strong bg-card-2 px-3 py-2.5 opacity-70"
      aria-label={`${marketLabel} ${ko.marketStatus.coming_soon}`}
    >
      <MarketLogo id={marketId} size="sm" label={marketLabel} />
      <span className="flex-1 text-[12.5px] font-medium text-dim">
        {marketLabel}
      </span>
      <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-faint">
        {ko.marketStatus.coming_soon}
      </span>
    </div>
  )
}
