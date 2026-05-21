import { Link } from 'react-router-dom'
import { Inbox, Truck, Printer, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorMessage,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { useOrdersSummary } from '../hooks/useOrdersSummary'
import { OrdersSummaryCard } from '../components/OrdersSummaryCard'
import { MarketBadge } from '../components/MarketBadge'

/**
 * OrdersDashboardPage — n47 (/orders).
 *
 * 마스터:
 *  - user_flow-v2-shipping.md s7
 *  - PRD-v2-shipping.md §2.5 (대시보드 섹션)
 *
 * 구성:
 *  - 오늘 요약 카드 4종 (신규 주문 / 로젠 등록 / 출력 대기 / 제출 완료)
 *  - 빠른 액션 (운송장 출력 / 송장 일괄 제출) — features/shipping/ (PR9) 가 라우트 구현
 *  - 마켓별 신규 주문 뱃지 (실시간 갱신은 useOrdersSummary 가 담당)
 *  - 4상태: data / loading / error / empty
 */
export function OrdersDashboardPage(): JSX.Element {
  const summary = useOrdersSummary()

  const state: 'loading' | 'data' | 'error' = summary.isLoading
    ? 'loading'
    : summary.isError
      ? 'error'
      : 'data'

  const data = summary.data ?? null
  const totalToday =
    (data?.newOrdersCount ?? 0) +
    (data?.logenRegisteredCount ?? 0) +
    (data?.waybillPendingCount ?? 0) +
    (data?.dispatchSubmittedCount ?? 0)
  const isEmpty = state === 'data' && totalToday === 0

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.orders.dashboard.title}
        subtitle={ko.orders.dashboard.subtitle}
        actions={
          <Button asChild variant="ghost">
            <Link to="/orders/list">{ko.orders.dashboard.goToList}</Link>
          </Button>
        }
      />

      {/* 요약 카드 4종 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <OrdersSummaryCard
          label={ko.orders.dashboard.newOrdersLabel}
          value={data?.newOrdersCount ?? 0}
          hint={ko.orders.dashboard.newOrdersHint}
          state={state}
          icon={<Inbox className="h-4 w-4" aria-hidden />}
          emphasis="attention"
        />
        <OrdersSummaryCard
          label={ko.orders.dashboard.logenRegisteredLabel}
          value={data?.logenRegisteredCount ?? 0}
          hint={ko.orders.dashboard.logenRegisteredHint}
          state={state}
          icon={<Truck className="h-4 w-4" aria-hidden />}
        />
        <OrdersSummaryCard
          label={ko.orders.dashboard.waybillPendingLabel}
          value={data?.waybillPendingCount ?? 0}
          hint={ko.orders.dashboard.waybillPendingHint}
          state={state}
          icon={<Printer className="h-4 w-4" aria-hidden />}
        />
        <OrdersSummaryCard
          label={ko.orders.dashboard.dispatchSubmittedLabel}
          value={data?.dispatchSubmittedCount ?? 0}
          hint={ko.orders.dashboard.dispatchSubmittedHint}
          state={state}
          icon={<Send className="h-4 w-4" aria-hidden />}
        />
      </div>

      {/* 빠른 액션 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>빠른 액션</CardTitle>
          <CardDescription>운송장 출력 · 송장 일괄 제출 화면으로 바로 이동</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="primary">
            <Link to="/shipping/print">
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              {ko.orders.dashboard.actionPrint}
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link to="/shipping/dispatch">
              <Send className="mr-2 h-4 w-4" aria-hidden />
              {ko.orders.dashboard.actionDispatch}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 마켓별 신규 주문 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{ko.orders.dashboard.byMarketHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          {state === 'loading' ? (
            <div role="status" aria-live="polite" className="text-sm text-text-tertiary">
              {ko.orders.list.loading}
            </div>
          ) : state === 'error' ? (
            <ErrorMessage
              message={ko.orders.dashboard.errorLoad}
              {...(summary.error?.message ? { details: summary.error.message } : {})}
            />
          ) : isEmpty || !data || data.byMarket.length === 0 ? (
            <div className="rounded-md border border-border bg-surface-muted px-3 py-4 text-center text-sm text-text-secondary">
              <div>{ko.orders.dashboard.empty}</div>
              <div className="mt-1 text-xs text-text-tertiary">
                {ko.orders.dashboard.emptyHint}
              </div>
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.byMarket.map((m) => (
                <li
                  key={m.marketId}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-xs"
                >
                  <MarketBadge marketId={m.marketId} />
                  <span className="tabular-nums text-text">
                    {m.newOrdersCount.toLocaleString()}건
                  </span>
                  {m.pendingCount > 0 ? (
                    <span className="text-text-tertiary">
                      (대기 {m.pendingCount.toLocaleString()})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default OrdersDashboardPage
