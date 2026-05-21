import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { useShippingPrintList } from '../hooks/useShippingPrintList'
import { useMarkWaybillPrinted } from '../hooks/useMarkWaybillPrinted'
import { ShippingApiError } from '../api/shipping-api'
import { buildOutSlipPrintPopUrl } from '../api/logen-print-stub'

/**
 * ShippingPrintPage — n52 (운송장 출력) — `/shipping/print`.
 *
 * 마스터:
 *  - user_flow-v2-shipping.md n52
 *  - PRD-v2-shipping.md §2.3.1
 *
 * 동작:
 *  1. 로젠 status=logen_registered 주문 목록 (운송장번호 표시).
 *  2. [출력 팝업 열기] → window.open(buildOutSlipPrintPopUrl({waybills})).
 *  3. [출력 완료] → mutation: orders.shipping_status='waybill_printed'.
 *  4. 미연동 경고 배너 (settings/shipping 유도) — 현재는 정적 noticeable banner stub.
 *
 * 4상태: loading / data / error / empty.
 */
export function ShippingPrintPage(): JSX.Element {
  const { data, isLoading, isError, error, refetch } = useShippingPrintList()
  const markPrinted = useMarkWaybillPrinted()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const orders = useMemo(() => data ?? [], [data])
  const allWaybills = useMemo(() => orders.map((o) => o.waybillNumber), [orders])

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.orderId)),
    [orders, selectedIds],
  )

  const toggleAll = (): void => {
    if (selectedIds.size === orders.length && orders.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map((o) => o.orderId)))
    }
  }

  const toggleOne = (orderId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const handleOpenPrintPopup = (): void => {
    const waybills =
      selectedOrders.length > 0 ? selectedOrders.map((o) => o.waybillNumber) : allWaybills
    if (waybills.length === 0) {
      toast.error('출력할 운송장이 없습니다.')
      return
    }
    try {
      const url = buildOutSlipPrintPopUrl({ waybillNumbers: waybills })
      const popup = window.open(url, 'logen-print-pop', 'width=900,height=700')
      if (!popup) {
        toast.error('팝업이 차단되었습니다. 브라우저 팝업 허용을 확인해주세요.')
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '팝업 URL 생성 실패'
      toast.error(message)
    }
  }

  const handleMarkPrinted = (): void => {
    const targetIds = selectedOrders.length > 0 ? selectedOrders.map((o) => o.orderId) : orders.map((o) => o.orderId)
    if (targetIds.length === 0) {
      toast.error('대상 주문이 없습니다.')
      return
    }
    markPrinted.mutate(
      { orderIds: targetIds },
      {
        onSuccess: (resp) => {
          toast.success(`${resp.updatedCount}건 출력 완료 처리`)
          setSelectedIds(new Set())
        },
        onError: (e) => {
          const message =
            e instanceof ShippingApiError ? e.message : '출력 완료 처리에 실패했습니다.'
          toast.error(message)
        },
      },
    )
  }

  // 실행 버튼 비활성 사유
  const printBlocking: string[] = []
  if (orders.length === 0) printBlocking.push('출력할 주문이 없습니다.')

  const markBlocking: string[] = []
  if (orders.length === 0) markBlocking.push('출력 대상 주문이 없습니다.')
  if (markPrinted.isPending) markBlocking.push('처리 중입니다.')

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="운송장 출력"
        subtitle="로젠에 등록된 주문의 운송장을 출력하고 출력 완료 처리합니다"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings/shipping">로젠 연동 설정</Link>
          </Button>
        }
      />

      {/* 미연동 안내 — PR10 (settings) 가 연결 상태 hook 을 제공하면 조건부 표시로 교체. */}
      <Card className="mb-4 border-warning/40 bg-warning/5">
        <CardContent className="py-3">
          <p className="text-sm text-text">
            로젠 연동이 필요합니다.{' '}
            <Link to="/settings/shipping" className="text-accent underline">
              설정 → 로젠 연동
            </Link>
            에서 계정을 연결해주세요.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>출력 대상 ({orders.length}건)</CardTitle>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPrintPopup}
                    disabled={printBlocking.length > 0}
                    aria-describedby={
                      printBlocking.length > 0 ? 'print-popup-blocking' : undefined
                    }
                  >
                    출력 팝업 열기
                  </Button>
                </span>
              </TooltipTrigger>
              {printBlocking.length > 0 && (
                <TooltipContent id="print-popup-blocking">
                  <ul className="space-y-0.5 text-xs">
                    {printBlocking.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleMarkPrinted}
                    disabled={markBlocking.length > 0}
                    aria-describedby={
                      markBlocking.length > 0 ? 'mark-printed-blocking' : undefined
                    }
                  >
                    {markPrinted.isPending ? '처리 중…' : '출력 완료'}
                  </Button>
                </span>
              </TooltipTrigger>
              {markBlocking.length > 0 && (
                <TooltipContent id="mark-printed-blocking">
                  <ul className="space-y-0.5 text-xs">
                    {markBlocking.map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-32 w-full" />}
          {isError && (
            <div className="space-y-2">
              <ErrorMessage
                message={
                  error instanceof ShippingApiError
                    ? error.message
                    : '주문 목록을 불러오지 못했습니다.'
                }
              />
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                다시 시도
              </Button>
            </div>
          )}
          {data && orders.length === 0 && (
            <p className="py-8 text-center text-sm text-text-tertiary">
              출력 대기 중인 운송장이 없습니다.
            </p>
          )}
          {data && orders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="w-10 px-2 py-2 text-left">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-accent"
                        aria-label="전체 선택"
                        checked={selectedIds.size === orders.length && orders.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-2 py-2 text-left">마켓</th>
                    <th className="px-2 py-2 text-left">주문번호</th>
                    <th className="px-2 py-2 text-left">상품명</th>
                    <th className="px-2 py-2 text-left">구매자</th>
                    <th className="px-2 py-2 text-left">운송장번호</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderId} className="border-b border-border/50 hover:bg-surface-muted">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border accent-accent"
                          aria-label={`${o.marketOrderNo} 선택`}
                          checked={selectedIds.has(o.orderId)}
                          onChange={() => toggleOne(o.orderId)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="default">{ko.market[o.marketId]}</Badge>
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">{o.marketOrderNo}</td>
                      <td className="px-2 py-2 max-w-[280px] truncate">{o.productName}</td>
                      <td className="px-2 py-2">{o.buyerName}</td>
                      <td className="px-2 py-2 font-mono text-xs">{o.waybillNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ShippingPrintPage
