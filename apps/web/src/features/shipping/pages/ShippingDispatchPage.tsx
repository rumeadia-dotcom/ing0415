import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
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
import { ShippingTabsNav } from '../components/ShippingTabsNav'
import { MarketBadge } from '@/features/orders/components/MarketBadge'

/**
 * ShippingDispatchPage — n53 (송장 일괄 제출 미리보기) — `/shipping/dispatch`.
 *
 * Studio 룩 — segmented tabs + 미리보기 카드 (마켓별 그룹) + 제출 시작 행.
 *
 * 마스터:
 *  - user_flow.md n53
 *  - PRD.md §6.3
 *
 * 4상태: loading / data / error / empty.
 */
export function ShippingDispatchPage(): JSX.Element {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useShippingDispatchPreview()
  const start = useShippingDispatchStart()
  const [autoSubmit, setAutoSubmit] = useState<boolean>(false)

  const handleStart = (): void => {
    if (!data) return
    if (data.printedOrders === 0) {
      toast.error(ko.commonToasts.noOrdersToDispatch)
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
        title={ko.shipping.dispatch.title}
        subtitle={ko.shipping.dispatch.subtitle}
        actions={<AutoSubmitToggle checked={autoSubmit} onChange={setAutoSubmit} />}
      />

      <ShippingTabsNav />

      {isLoading && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <Skeleton className="h-32 w-full" />
        </section>
      )}

      {isError && (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
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
        </section>
      )}

      {data && (
        <>
          {data.unprintedOrders > 0 && (
            <div
              className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft/40 p-4"
              role="status"
            >
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-warning text-xs font-bold text-white"
              >
                !
              </span>
              <p className="text-sm text-text">
                출력 미완료 주문이 <strong>{data.unprintedOrders}건</strong> 있습니다.
                지금 제출하면 해당 주문은 제외됩니다.{' '}
                <Link
                  to="/shipping/print"
                  className="font-semibold text-accent underline"
                >
                  운송장 출력 페이지로 이동
                </Link>
              </p>
            </div>
          )}

          <section className="mb-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <header className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-bold text-text">제출 미리보기</h2>
              {data.printedOrders > 0 ? (
                <div className="text-xs text-text-tertiary">
                  총{' '}
                  <span className="font-mono font-semibold text-text">
                    {data.printedOrders.toLocaleString()}
                  </span>
                  건 · 마켓{' '}
                  <span className="font-semibold text-text">
                    {data.marketGroups.length}
                  </span>
                  개
                </div>
              ) : null}
            </header>
            {data.printedOrders === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-text">
                  제출 가능한 주문이 없습니다. 운송장 출력을 먼저 완료해주세요.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.marketGroups.map((g) => (
                  <li
                    key={g.marketId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/40 px-3 py-3"
                  >
                    <MarketBadge marketId={g.marketId} />
                    <span className="font-mono tabular-nums text-sm font-bold text-text">
                      {g.orderCount.toLocaleString()}건
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

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
                    <Send className="h-4 w-4" aria-hidden />
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
