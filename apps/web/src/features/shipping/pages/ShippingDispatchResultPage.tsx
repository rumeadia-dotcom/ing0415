import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
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
import { useShippingJob } from '../hooks/useShippingJob'
import { useShippingJobRetry } from '../hooks/useShippingJobRetry'
import { ShippingProgressBar } from '../components/ShippingProgressBar'
import { MarketDispatchRow } from '../components/MarketDispatchRow'
import { ShippingApiError } from '../api/shipping-api'

/**
 * ShippingDispatchResultPage — n54 + n55 (+ n56 부분 재시도) — `/shipping/dispatch/:jobId/result`.
 *
 * 마스터:
 *  - user_flow-v2-shipping.md n54 / n55 / n56
 *  - PRD-v2-shipping.md §2.3.3
 *
 * 동작:
 *  1. Realtime 으로 진행률 갱신 (5sec polling fallback).
 *  2. 마켓별 진행중/완료/실패 상태 표시.
 *  3. 완료 시 결과 요약 + 실패 건 [재시도] 버튼 (n56).
 *
 * 5상태: loading / data / error / empty / partial (PRD 룰 §RegistrationJob 와 동등).
 */
export function ShippingDispatchResultPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()
  const { data, isLoading, isError, error } = useShippingJob(jobId ?? '')
  const retry = useShippingJobRetry()

  if (!jobId) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <PageHeader title="송장 제출 결과" subtitle="유효하지 않은 잡 ID 입니다" />
        <Card>
          <CardContent className="py-6">
            <Button asChild variant="ghost">
              <Link to="/shipping/history">이력으로</Link>
            </Button>
          </CardContent>
        </Card>
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
      toast.info('재시도 가능한 마켓이 없습니다.')
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
      <PageHeader
        title="송장 제출 결과"
        subtitle={`Job ID: ${jobId}`}
      />

      {isLoading && (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="py-6">
            <ErrorMessage
              message={
                error instanceof ShippingApiError
                  ? error.message
                  : '잡 정보를 불러오지 못했습니다.'
              }
            />
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>진행률</CardTitle>
            </CardHeader>
            <CardContent>
              <ShippingProgressBar job={data.job} results={data.results} />
            </CardContent>
          </Card>

          {isPartial && (
            <Card className="mb-4 border-warning/40 bg-warning/5">
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <p className="text-sm text-text">
                  일부 마켓이 실패했습니다. 실패한 마켓만 다시 시도할 수 있습니다.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRetryAllFailed}
                  disabled={retry.isPending}
                >
                  {retry.isPending ? '재시도 중…' : '실패한 마켓 모두 재시도'}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>마켓별 결과</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/shipping/history">배송 이력으로</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/dashboard">대시보드로</Link>
        </Button>
      </div>
    </div>
  )
}

export default ShippingDispatchResultPage
