import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ErrorMessage, Skeleton } from '@/components/ui'
import { useShippingJob } from '../hooks/useShippingJob'
import { useShippingJobRetry } from '../hooks/useShippingJobRetry'
import { ShippingProgressBar } from '../components/ShippingProgressBar'
import { MarketDispatchRow } from '../components/MarketDispatchRow'
import { ShippingApiError } from '../api/shipping-api'
import { ko } from '@/locales/ko'

/**
 * ShippingDispatchResultPage — n54 + n55 (+ n56 부분 재시도) — `/shipping/dispatch/:jobId/result`.
 *
 * Studio 룩 — 진행률 카드 + (partial 시) 경고 배너 + 마켓별 결과 리스트.
 *
 * 5상태: loading / data / error / empty / partial (RegistrationJob 룰 동등).
 */
export function ShippingDispatchResultPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()
  const { data, isLoading, isError, error } = useShippingJob(jobId ?? '')
  const retry = useShippingJobRetry()

  if (!jobId) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <PageHeader title="송장 제출 결과" subtitle="유효하지 않은 잡 ID 입니다" />
        <FallbackCard>
          <BackLink to="/shipping/history" label="이력으로" />
        </FallbackCard>
      </div>
    )
  }

  const handleRetryOne = (resultId: string): void => {
    retry.mutate(
      { jobId, marketResultIds: [resultId] },
      {
        onError: (e) => {
          const message =
            e instanceof ShippingApiError ? e.message : '재시도에 실패했습니다.'
          toast.error(message)
        },
      },
    )
  }

  const handleRetryAllFailed = (): void => {
    if (!data) return
    const failedIds = data.results
      .filter((r) => r.status === 'failed')
      .map((r) => r.id)
    if (failedIds.length === 0) {
      toast.info(ko.commonToasts.noRetryableMarkets)
      return
    }
    retry.mutate(
      { jobId, marketResultIds: failedIds },
      {
        onError: (e) => {
          const message =
            e instanceof ShippingApiError ? e.message : '재시도에 실패했습니다.'
          toast.error(message)
        },
      },
    )
  }

  const isPartial = data?.job.status === 'partial'

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader title="송장 제출 결과" subtitle={`Job ID: ${jobId}`} />

      {isLoading && (
        <FallbackCard>
          <Skeleton className="h-32 w-full" />
        </FallbackCard>
      )}

      {isError && (
        <FallbackCard>
          <ErrorMessage
            message={
              error instanceof ShippingApiError
                ? error.message
                : '잡 정보를 불러오지 못했습니다.'
            }
          />
        </FallbackCard>
      )}

      {data && (
        <>
          <section className="mb-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-text">진행률</h2>
            <ShippingProgressBar job={data.job} results={data.results} />
          </section>

          {isPartial && (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning-soft/40 p-4"
              role="status"
            >
              <p className="text-sm text-text">
                일부 마켓이 실패했습니다. 실패한 마켓만 다시 시도할 수 있습니다.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetryAllFailed}
                disabled={retry.isPending}
              >
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                {retry.isPending ? '재시도 중…' : '실패한 마켓 모두 재시도'}
              </Button>
            </div>
          )}

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-text">마켓별 결과</h2>
            {data.results.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-tertiary">
                마켓별 결과가 아직 없습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.results.map((r) => (
                  <MarketDispatchRow
                    key={r.id}
                    result={r}
                    onRetry={handleRetryOne}
                    retrying={retry.isPending}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/shipping/history">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            배송 이력으로
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/dashboard">대시보드로</Link>
        </Button>
      </div>
    </div>
  )
}

function FallbackCard({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {children}
    </section>
  )
}

function BackLink({ to, label }: { to: string; label: string }): JSX.Element {
  return (
    <Button asChild variant="ghost">
      <Link to={to}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {label}
      </Link>
    </Button>
  )
}

export default ShippingDispatchResultPage
