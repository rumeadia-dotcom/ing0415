import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { ko } from '@/locales/ko'
import { useShippingDispatchPreview } from '../hooks/useShippingDispatchPreview'
import { useShippingDispatchStart } from '../hooks/useShippingDispatchStart'
import { AutoSubmitToggle } from '../components/AutoSubmitToggle'
import { ShippingApiError } from '../api/shipping-api'

/**
 * ShippingDispatchPage — n53 (송장 일괄 제출 미리보기) — `/shipping/dispatch`.
 *
 * 마스터:
 *  - user_flow.md n53
 *  - PRD.md §6.3
 *
 * 동작:
 *  1. status=waybill_printed 주문을 마켓별로 group 한 미리보기.
 *  2. status=logen_registered (출력 미완료) 주문 존재 시 경고 배너 (강제 차단 X).
 *  3. [제출 시작] → shipping-dispatch-job invoke → /shipping/dispatch/:jobId/result.
 *  4. "출력 후 자동 제출" 토글 (PR10 settings persistence 연동 전 로컬 state).
 *
 * 4상태: loading / data / error / empty.
 */
export function ShippingDispatchPage(): JSX.Element {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useShippingDispatchPreview()
  const start = useShippingDispatchStart()
  // settings (PR10) 가 mount 되기 전 임시 로컬 state — settings useShippingSettings() 가 들어오면 교체.
  const [autoSubmit, setAutoSubmit] = useState<boolean>(false)

  const handleStart = (): void => {
    if (!data) return
    if (data.printedOrders === 0) {
      toast.error('제출 가능한 주문이 없습니다. 운송장 출력을 먼저 진행해주세요.')
      return
    }
    start.mutate(
      {},
      {
        onSuccess: (resp) => {
          toast.success(`${resp.totalOrders}건 송장 제출을 시작했습니다.`)
          navigate(`/shipping/dispatch/${resp.jobId}/result`)
        },
        onError: (e) => {
          const message =
            e instanceof ShippingApiError ? e.message : '제출을 시작하지 못했습니다.'
          toast.error(message)
        },
      },
    )
  }

  const startBlocking: string[] = []
  if (isLoading) startBlocking.push('로드 중입니다.')
  if (data && data.printedOrders === 0) startBlocking.push('출력 완료된 주문이 0건입니다.')
  if (start.isPending) startBlocking.push('제출 시작 진행 중입니다.')

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="송장 일괄 제출"
        subtitle="출력 완료된 운송장을 각 마켓에 일괄 송장 등록합니다"
        actions={<AutoSubmitToggle checked={autoSubmit} onChange={setAutoSubmit} />}
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
            <div className="space-y-2">
              <ErrorMessage
                message={
                  error instanceof ShippingApiError
                    ? error.message
                    : '미리보기를 불러오지 못했습니다.'
                }
              />
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {data.unprintedOrders > 0 && (
            <Card className="mb-4 border-warning/40 bg-warning/5">
              <CardContent className="py-3">
                <p className="text-sm text-text">
                  출력 미완료 주문이 <strong>{data.unprintedOrders}건</strong> 있습니다.
                  지금 제출하면 해당 주문은 제외됩니다.{' '}
                  <Link to="/shipping/print" className="text-accent underline">
                    운송장 출력 페이지로 이동
                  </Link>
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>제출 미리보기</CardTitle>
            </CardHeader>
            <CardContent>
              {data.printedOrders === 0 ? (
                <p className="py-8 text-center text-sm text-text-tertiary">
                  제출 가능한 주문이 없습니다. 운송장 출력을 먼저 완료해주세요.
                </p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-text">
                    총 <strong>{data.printedOrders.toLocaleString()}건</strong> · 마켓{' '}
                    <strong>{data.marketGroups.length}개</strong>
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {data.marketGroups.map((g) => (
                      <li
                        key={g.marketId}
                        className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2"
                      >
                        <Badge variant="default">{ko.market[g.marketId]}</Badge>
                        <span className="text-sm font-medium text-text">
                          {g.orderCount.toLocaleString()}건
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button asChild variant="ghost">
              <Link to="/shipping/print">출력 페이지로</Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="primary"
                    onClick={handleStart}
                    disabled={startBlocking.length > 0}
                    aria-describedby={
                      startBlocking.length > 0 ? 'dispatch-start-blocking' : undefined
                    }
                  >
                    {start.isPending ? '제출 시작 중…' : '제출 시작'}
                  </Button>
                </span>
              </TooltipTrigger>
              {startBlocking.length > 0 && (
                <TooltipContent id="dispatch-start-blocking">
                  <ul className="space-y-0.5 text-xs">
                    {startBlocking.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </>
      )}
    </div>
  )
}

export default ShippingDispatchPage
