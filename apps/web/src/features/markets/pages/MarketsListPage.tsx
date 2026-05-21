import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  ErrorMessage,
  Skeleton,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { useAuth } from '@/features/auth'
import { useMarketAccounts } from '../hooks/useMarketAccounts'
import { useMarketAccountsRealtime } from '../hooks/useMarketAccountsRealtime'
import { MarketStackSummary } from '../components/MarketStackSummary'
import { MarketAccountRow } from '../components/MarketAccountRow'
import { MarketAccountCard } from '../components/MarketAccountCard'
import { MarketAccountEmpty } from '../components/MarketAccountEmpty'
import { MarketApiInvocationError } from '../api/markets-api'
import { formatMarketError } from '../utils/market-error-messages'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

/**
 * MarketsListPage — n34 / n35 연결된 마켓 계정 목록.
 * 마스터: docs/architecture/v1/features/markets.md §7.1
 * Studio s5 reference: studio-domains.jsx StudioMarkets (summary strip → warning banner → accounts table).
 *
 * 4상태 + 부분:
 *  - loading → 스켈레톤 라인 4
 *  - error → ErrorMessage + 재시도
 *  - empty → MarketAccountEmpty
 *  - data → MarketStackSummary + (md+ 테이블 / mobile 카드 그리드)
 *  - partial → active 0 일 때 경고 배너 (재인증 안내)
 */
export function MarketsListPage(): JSX.Element {
  const { user } = useAuth()
  useMarketAccountsRealtime(user?.id ?? null)
  const { data, isLoading, isError, error, refetch } = useMarketAccounts()
  const t = ko.markets.page

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title={t.title} subtitle={t.subtitleLine1} />

      {isLoading && <LoadingState />}
      {!isLoading && isError && <ErrorState error={error} onRetry={() => void refetch()} />}
      {!isLoading && !isError && (!data || data.length === 0) && <MarketAccountEmpty />}
      {!isLoading && !isError && data && data.length > 0 && <DataState accounts={data} />}
    </div>
  )
}

function LoadingState(): JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }): JSX.Element {
  const formatted =
    error instanceof MarketApiInvocationError
      ? formatMarketError(error.toApiError())
      : formatMarketError(null)
  return (
    <Card>
      <CardContent className="py-8">
        <ErrorMessage
          message={
            <>
              <div>마켓 목록을 불러오지 못했습니다</div>
              <div className="mt-1 font-normal">{formatted.message}</div>
            </>
          }
          {...(formatted.correlationId ? { details: `요청 ID: ${formatted.correlationId}` } : {})}
        />
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DataState({ accounts }: { accounts: MarketAccount[] }): JSX.Element {
  const hasActive = accounts.some((a) => a.status === 'active')
  const expiredAccount = accounts.find((a) => a.status === 'expired')
  const t = ko.markets

  return (
    <>
      <MarketStackSummary accounts={accounts} />

      {!hasActive && (
        <Card className="mb-4 border-[color:rgb(var(--warning)/0.4)] bg-warning-soft">
          <CardContent className="py-3 text-sm text-warning-on-soft">
            모든 마켓이 재인증 필요 또는 해제 상태입니다. 상품 등록 전에 1개 이상의 마켓을 다시 연결하세요.
          </CardContent>
        </Card>
      )}

      {hasActive && expiredAccount && (
        <ExpiringBanner accountLabel={expiredAccount.accountLabel} marketId={expiredAccount.marketId} />
      )}

      {/* 데스크탑: 테이블 */}
      <Card className="hidden md:block">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold text-text">{t.page.sectionConnected}</h2>
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-text-tertiary">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            {t.page.live}
          </span>
        </header>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-[10.5px] font-bold uppercase tracking-wider text-text-tertiary">
                <th scope="col" className="py-2.5 pl-5 pr-2 w-12 font-bold">
                  <span className="sr-only">아이콘</span>
                </th>
                <th scope="col" className="py-2.5 px-3 font-bold">
                  {t.table.colMarket}
                </th>
                <th scope="col" className="py-2.5 px-3 font-bold">
                  {t.table.colAccount}
                </th>
                <th scope="col" className="py-2.5 px-3 font-bold">
                  {t.table.colExpiry}
                </th>
                <th scope="col" className="py-2.5 px-3 font-bold">
                  {t.table.colStatus}
                </th>
                <th scope="col" className="py-2.5 pl-2 pr-5 text-right font-bold">
                  {t.table.colActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <MarketAccountRow key={a.id} account={a} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 모바일: 카드 */}
      <div className="grid gap-3 md:hidden">
        {accounts.map((a) => (
          <MarketAccountCard key={a.id} account={a} />
        ))}
      </div>
    </>
  )
}

function ExpiringBanner({
  accountLabel,
  marketId,
}: {
  accountLabel: string
  marketId: string
}): JSX.Element {
  const t = ko.markets.banners
  // 만료 임박 안내 (D-day) — 실 D-day 는 마켓 API 응답에 기반해야 하나 v1 schema 미노출이라 일반 메시지.
  return (
    <Card className="mb-4 border-[color:rgb(var(--warning)/0.4)] bg-warning-soft">
      <CardContent className="flex items-center gap-3 py-3">
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warning text-xs font-bold text-white"
        >
          !
        </span>
        <div className="flex-1 text-sm text-warning-on-soft">
          <strong className="font-bold">{accountLabel}</strong> {ko.markets.status.expired}.{' '}
          <span className="font-normal opacity-90">{t.expiringBody}</span>
        </div>
        <Button asChild variant="primary" size="sm">
          <Link to={`/markets/connect/${marketId}`}>{t.expiringCta}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default MarketsListPage
