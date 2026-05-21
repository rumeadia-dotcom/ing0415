import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorMessage,
  Skeleton,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { formatRelativeTime } from '@/lib/format-time'
import { useShippingJobs } from '../hooks/useShippingJobs'
import { ShippingJobStatusBadge } from '../components/ShippingJobStatusBadge'
import { ShippingApiError } from '../api/shipping-api'

/**
 * ShippingHistoryPage — n57 (배송 이력) — `/shipping/history`.
 *
 * 마스터:
 *  - user_flow-v2-shipping.md n57
 *  - PRD-v2-shipping.md §2.4
 *
 * 동작:
 *  - 날짜별 ShippingJob 목록 (최근 100건).
 *  - 행 클릭 → /shipping/dispatch/:jobId/result 이동.
 *
 * 4상태: loading / data / error / empty.
 */
export function ShippingHistoryPage(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useShippingJobs()
  const jobs = data ?? []

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader title="배송 이력" subtitle="최근 송장 일괄 제출 작업 이력" />

      <Card>
        <CardHeader>
          <CardTitle>최근 작업 ({jobs.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
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
            <p className="py-8 text-center text-sm text-text-tertiary">
              아직 배송 이력이 없습니다.
            </p>
          )}
          {data && jobs.length > 0 && (
            <ul className="space-y-2">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    to={`/shipping/dispatch/${j.id}/result`}
                    className="block rounded border border-border bg-surface px-3 py-3 transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    aria-label={`작업 ${j.id} 상세 보기`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <ShippingJobStatusBadge status={j.status} />
                          <span className="text-xs text-text-tertiary">
                            {formatRelativeTime(j.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-text">
                          총 {j.totalOrders.toLocaleString()}건 · 성공{' '}
                          {j.successCount.toLocaleString()} · 실패{' '}
                          {j.failedCount.toLocaleString()}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {j.marketIds.map((m) => (
                            <Badge key={m} variant="default">
                              {ko.market[m]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ShippingHistoryPage
