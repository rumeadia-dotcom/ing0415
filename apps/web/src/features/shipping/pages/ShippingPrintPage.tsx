import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Printer, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  ErrorMessage,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import { useShippingPrintList } from '../hooks/useShippingPrintList'
import { useMarkWaybillPrinted } from '../hooks/useMarkWaybillPrinted'
import { ShippingApiError } from '../api/shipping-api'
import { buildOutSlipPrintPopUrl } from '../api/logen-print-stub'
import { ShippingTabsNav } from '../components/ShippingTabsNav'
import { MarketBadge } from '@/features/orders/components/MarketBadge'

/**
 * ShippingPrintPage — n52 (운송장 출력) — `/shipping/print`.
 *
 * Studio 룩 (s8 Shipping print):
 *  - 상단 segmented tabs (출력 / 일괄 제출 / 이력).
 *  - 액션 바: 출력 대상 카운트 + 선택 카운트 + 자동제출 토글 hint + 실행 버튼.
 *  - 본문: 체크박스 + 마켓 컬러 바 + 주문번호 + 상품/구매자 + 마켓 + 운송장 번호 + 로젠 등록 상태.
 *
 * 마스터:
 *  - user_flow.md n52
 *  - PRD.md §6.3
 *  - design-renewal/designFile/concepts/studio-domains.jsx StudioShipping
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
      toast.error(ko.commonToasts.noWaybillsToPrint)
      return
    }
    try {
      const url = buildOutSlipPrintPopUrl({ waybillNumbers: waybills })
      const popup = window.open(url, 'logen-print-pop', 'width=900,height=700')
      if (!popup) {
        toast.error(ko.commonToasts.popupBlocked)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '팝업 URL 생성 실패'
      toast.error(message)
    }
  }

  const handleMarkPrinted = (): void => {
    const targetIds =
      selectedOrders.length > 0
        ? selectedOrders.map((o) => o.orderId)
        : orders.map((o) => o.orderId)
    if (targetIds.length === 0) {
      toast.error(ko.commonToasts.noOrdersToProcess)
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

  const printBlocking: string[] = []
  if (orders.length === 0) printBlocking.push('출력할 주문이 없습니다.')

  const markBlocking: string[] = []
  if (orders.length === 0) markBlocking.push('출력 대상 주문이 없습니다.')
  if (markPrinted.isPending) markBlocking.push('처리 중입니다.')

  const popupCount = selectedOrders.length > 0 ? selectedOrders.length : orders.length

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.shipping.print.title}
        subtitle={ko.shipping.print.subtitle}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings/shipping">로젠 연동 설정</Link>
          </Button>
        }
      />

      <ShippingTabsNav />

      {/* 미연동 안내 — PR10 settings 연동 hook 도입 시 조건부로 교체. */}
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft/40 p-4">
        <span
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-warning text-xs font-bold text-white"
        >
          !
        </span>
        <p className="text-sm text-text">
          로젠 연동이 필요합니다.{' '}
          <Link to="/settings/shipping" className="font-semibold text-accent underline">
            설정 → 로젠 연동
          </Link>
          에서 자격증명을 등록해 주세요.
        </p>
      </div>

      {/* 액션 바 */}
      <section className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm">
        <div>
          <div className="text-xs font-semibold text-text-secondary">출력 대상</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold leading-none tracking-tight text-text">
              {orders.length}
            </span>
            <span className="text-xs text-text-tertiary">
              건 ({selectedIds.size}건 선택됨)
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="hidden text-[11px] text-text-tertiary md:inline">
            출력 후 자동 제출 설정은 [설정 → 배송]
          </span>
          <span aria-hidden className="hidden h-6 w-px bg-border md:inline" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenPrintPopup}
                  disabled={printBlocking.length > 0}
                  aria-describedby={
                    printBlocking.length > 0 ? 'print-popup-blocking' : undefined
                  }
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  출력 팝업 열기 ({popupCount})
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
        </div>
      </section>

      {/* 본문 */}
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {isLoading && (
          <div className="p-5">
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {isError && (
          <div className="space-y-2 p-5">
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
          <div className="px-6 py-16 text-center">
            <div
              aria-hidden
              className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-surface-muted text-2xl"
            >
              <Send className="h-6 w-6 text-text-tertiary" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-text">
              출력 대기 중인 운송장이 없습니다.
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              로젠 자동 등록이 완료되면 여기에 자동으로 표시됩니다.
            </p>
          </div>
        )}
        {data && orders.length > 0 && (
          <>
            <div
              className="grid items-center gap-3 border-b border-border bg-surface-muted px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
              style={{
                gridTemplateColumns: '34px 6px 110px 1fr 110px 150px 90px',
              }}
            >
              <label className="inline-flex h-4 w-4 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-accent"
                  aria-label="전체 선택"
                  checked={selectedIds.size === orders.length && orders.length > 0}
                  onChange={toggleAll}
                />
              </label>
              <span aria-hidden />
              <span>주문번호</span>
              <span>상품 · 구매자</span>
              <span>마켓</span>
              <span>운송장번호</span>
              <span className="text-right">로젠 등록</span>
            </div>

            <ul>
              {orders.map((o, idx) => {
                const selected = selectedIds.has(o.orderId)
                return (
                  <li
                    key={o.orderId}
                    className={cn(
                      'grid items-center gap-3 px-5 py-3 text-sm transition-colors',
                      idx < orders.length - 1 && 'border-b border-border',
                      selected ? 'bg-accent-soft/30' : 'hover:bg-surface-muted/60',
                    )}
                    style={{
                      gridTemplateColumns: '34px 6px 110px 1fr 110px 150px 90px',
                    }}
                  >
                    <label className="inline-flex h-4 w-4 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-accent"
                        aria-label={`${o.marketOrderNo} 선택`}
                        checked={selected}
                        onChange={() => toggleOne(o.orderId)}
                      />
                    </label>
                    <span
                      aria-hidden
                      className={cn(
                        'h-6 w-[3px] rounded-sm',
                        o.marketId === 'naver' && 'bg-market-naver',
                        o.marketId === 'coupang' && 'bg-market-coupang',
                        o.marketId === 'gmarket' && 'bg-market-gmarket',
                        o.marketId === 'auction' && 'bg-market-auction',
                      )}
                    />
                    <span className="font-mono text-[11.5px] text-text-secondary">
                      {o.marketOrderNo}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text">{o.productName}</div>
                      <div className="mt-0.5 text-[11.5px] text-text-tertiary">
                        {o.buyerName}
                      </div>
                    </div>
                    <MarketBadge marketId={o.marketId} variant="plain" />
                    <span className="font-mono text-[11.5px] font-medium tracking-wide text-text">
                      {o.waybillNumber}
                    </span>
                    <span className="text-right text-[11px] font-semibold text-success-on-soft">
                      완료
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

export default ShippingPrintPage
