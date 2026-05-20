import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorMessage,
  Skeleton,
} from '@/components/ui'
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
 *
 * 4상태 + 부분:
 *  - loading → 스켈레톤 행 3
 *  - error → ErrorMessage + 재시도
 *  - empty → MarketAccountEmpty
 *  - data → MarketStackSummary + (md+ 테이블 / mobile 카드)
 *  - partial → active 0 일 때 경고 배너 (재인증 안내)
 */
export function MarketsListPage(): JSX.Element {
  const { user } = useAuth()
  useMarketAccountsRealtime(user?.id ?? null)
  const { data, isLoading, isError, error, refetch } = useMarketAccounts()

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="마켓 계정"
        subtitle="연결된 마켓을 관리하고 새 마켓을 연결합니다"
        actions={
          <Button asChild variant="primary">
            <Link to="/markets/connect">+ 신규 연결</Link>
          </Button>
        }
      />

      {isLoading && <LoadingState />}
      {!isLoading && isError && (
        <ErrorState error={error} onRetry={() => void refetch()} />
      )}
      {!isLoading && !isError && (!data || data.length === 0) && <MarketAccountEmpty />}
      {!isLoading && !isError && data && data.length > 0 && <DataState accounts={data} />}
    </div>
  )
}

function LoadingState(): JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
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

  return (
    <>
      <MarketStackSummary accounts={accounts} />

      {!hasActive && (
        <Card className="mb-4 border-warning/40 bg-warning-soft">
          <CardContent className="py-3 text-sm text-warning-on-soft">
            모든 마켓이 재인증 필요 또는 해제 상태입니다. 상품 등록 전에 1개 이상의 마켓을 다시 연결하세요.
          </CardContent>
        </Card>
      )}

      {/* 데스크탑: 테이블 */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>연결된 마켓</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th scope="col" className="py-2 pl-4 pr-2 font-medium">
                  마켓
                </th>
                <th scope="col" className="py-2 px-2 font-medium">
                  라벨
                </th>
                <th scope="col" className="py-2 px-2 font-medium">
                  상태
                </th>
                <th scope="col" className="py-2 px-2 font-medium">
                  마지막 확인
                </th>
                <th scope="col" className="py-2 px-4 text-right font-medium">
                  액션
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

export default MarketsListPage
