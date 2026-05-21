import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ErrorMessage, Skeleton } from '@/components/ui'
import { ko } from '@/locales/ko'
import { formatRelativeTime } from '@/lib/format-time'
import { useShippingJobs } from '../hooks/useShippingJobs'
import { ShippingJobStatusBadge } from '../components/ShippingJobStatusBadge'
import { ShippingTabsNav } from '../components/ShippingTabsNav'
import { ShippingApiError } from '../api/shipping-api'
import { MarketBadge } from '@/features/orders/components/MarketBadge'

/**
 * ShippingHistoryPage — n57 (배송 이력) — `/shipping/history`.
 *
 * Studio 룩 — segmented tabs + 카드형 jobs 리스트.
 *
 * 4상태: loading / data / error / empty.
 */
export function ShippingHistoryPage(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useShippingJobs()
  const jobs = data ?? []

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title="배송 이력" subtitle="최근 송장 일괄 제출 작업 이력" />

      <ShippingTabsNav />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <header className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-text">최근 작업</h2>
          {data ? (
            <span className="font-mono text-xs text-text-tertiary">
              {jobs.length}건
            </span>
          ) : null}
        </header>

        {isLoading && <Skeleton className="h-32 w-full" />}
        {isError && (
          <div className="space-y-2">
            <ErrorMessage
              message={
                error instanceof ShippingApiError
                  ? error.message
                  : '이력을 불러오지 못했습니다.'
              }
            />
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        )}
        {data && jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-text">
              아직 배송 이력이 없습니다.
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              송장을 한 번이라도 제출하면 여기에 표시됩니다.
            </p>
          </div>
        )}
        {data && jobs.length > 0 && (
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link
                  to={`/shipping/dispatch/${j.id}/result`}
                  className="block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={`작업 ${j.id} 상세 보기`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ShippingJobStatusBadge status={j.status} />
                    <span className="font-mono text-[11.5px] text-text-tertiary">
                      {formatRelativeTime(j.createdAt)}
                    </span>
                    <span className="ml-auto text-xs text-text-secondary">
                      총{' '}
                      <span className="font-mono font-semibold text-text">
                        {j.totalOrders.toLocaleString()}
                      </span>
                      건 · 성공{' '}
                      <span className="font-mono font-semibold text-success-on-soft">
                        {j.successCount.toLocaleString()}
                      </span>{' '}
                      · 실패{' '}
                      <span className="font-mono font-semibold text-danger-on-soft">
                        {j.failedCount.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {j.marketIds.map((m) => (
                      <MarketBadge
                        key={m}
                        marketId={m}
                        size="sm"
                        variant="plain"
                      />
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="sr-only">{ko.shipping.history.title}</p>
    </div>
  )
}

export default ShippingHistoryPage
