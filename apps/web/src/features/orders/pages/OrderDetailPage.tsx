import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ErrorMessage, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import { useOrderDetail } from '../hooks/useOrderDetail'
import { OrderStatusTimeline } from '../components/OrderStatusTimeline'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { MarketBadge } from '../components/MarketBadge'
import { OrderManualResolveDialog } from '../components/OrderManualResolveDialog'
import { formatRelativeTime } from '@/lib/format-time'
import type { MarketDispatchStatus } from '@/lib/schemas/orders'

/**
 * OrderDetailPage — n49 (/orders/:orderId).
 *
 * Studio 룩 (s7 OrdersDetail):
 *  - 실패 시 상단 위험 배너 (logen_failed) + 우측 수동 입력 강조 카드.
 *  - 2 컬럼 (좌 = 주문/배송/타임라인, 우 = 수동 입력 + 마켓 송장 제출).
 *  - 색상은 토큰만, mono 폰트는 운송장/외부주문번호.
 *
 * 4상태: loading / data / error / empty(notFound).
 */

const DISPATCH_TONE: Record<
  MarketDispatchStatus,
  { wrap: string; dot: string; label: keyof typeof ko.orders.dispatch }
> = {
  pending: {
    wrap: 'bg-surface-muted text-text-secondary',
    dot: 'bg-text-tertiary',
    label: 'pending',
  },
  submitted: { wrap: 'bg-success-soft text-success-on-soft', dot: 'bg-success', label: 'submitted' },
  failed: { wrap: 'bg-danger-soft text-danger-on-soft', dot: 'bg-danger', label: 'failed' },
}

export function OrderDetailPage(): JSX.Element {
  const { orderId } = useParams<{ orderId: string }>()
  const { data, isLoading, isError, error } = useOrderDetail(orderId)

  if (!orderId) {
    return (
      <DetailShell>
        <PageHeader title={ko.orders.detail.title} subtitle={ko.orders.detail.notFound} />
        <FallbackCard>
          <p className="mb-3 text-sm text-text-secondary">{ko.orders.detail.notFound}</p>
          <BackLink />
        </FallbackCard>
      </DetailShell>
    )
  }

  if (isLoading) {
    return (
      <DetailShell
        role="status"
        ariaLabel="주문 상세 불러오는 중"
      >
        <PageHeader
          title={ko.orders.detail.title}
          subtitle={ko.orders.detail.subtitleFallback}
        />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </DetailShell>
    )
  }

  if (isError) {
    return (
      <DetailShell>
        <PageHeader title={ko.orders.detail.title} subtitle={`Order ID: ${orderId}`} />
        <FallbackCard>
          <ErrorMessage
            message={ko.orders.detail.errorLoad}
            {...(error instanceof Error ? { details: error.message } : {})}
          />
          <div className="mt-3">
            <BackLink />
          </div>
        </FallbackCard>
      </DetailShell>
    )
  }

  if (!data) {
    return (
      <DetailShell>
        <PageHeader title={ko.orders.detail.title} subtitle={ko.orders.detail.notFound} />
        <FallbackCard>
          <p className="mb-3 text-sm text-text-secondary">{ko.orders.detail.notFound}</p>
          <BackLink />
        </FallbackCard>
      </DetailShell>
    )
  }

  const { order } = data
  const isFailure = order.shippingStatus === 'logen_failed'

  return (
    <DetailShell>
      <PageHeader
        title={order.productName}
        subtitle={`#${order.externalOrderId}`}
        actions={<OrderStatusBadge status={order.shippingStatus} size="md" />}
      />

      {/* 실패 배너 */}
      {isFailure ? (
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft/60 px-4 py-3"
          role="alert"
        >
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-danger text-base font-bold text-white"
          >
            !
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-text">{ko.orders.detail.failureBannerTitle}</div>
            <div className="mt-0.5 text-xs text-text-secondary">
              {ko.orders.detail.failureBannerBody}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* 주문 정보 */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-base font-bold text-text">
                {ko.orders.detail.sectionOrder}
              </h2>
              <span className="ml-auto inline-flex items-center gap-2">
                <MarketBadge marketId={order.marketId} size="md" />
              </span>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KV label={ko.orders.detail.labelExternalOrderId}>
                <span className="font-mono">{order.externalOrderId}</span>
              </KV>
              <KV label={ko.orders.detail.labelOrderedAt}>
                {formatRelativeTime(order.orderedAt)}
              </KV>
              <KV label={ko.orders.detail.labelProduct}>
                <span className="font-semibold">{order.productName}</span>
              </KV>
              <KV label={ko.orders.detail.labelOption}>
                {order.productOption ?? '—'} / {order.quantity.toLocaleString()}개
              </KV>
            </dl>
          </section>

          {/* 배송 정보 */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-text">
              {ko.orders.detail.sectionShipping}
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <KV label={ko.orders.detail.labelBuyer}>
                {order.buyerMaskedName}
                {order.buyerMaskedPhone ? ` · ${order.buyerMaskedPhone}` : ''}
              </KV>
              <KV label={ko.orders.detail.labelAddress}>{order.shippingAddressMasked}</KV>
              <KV label={ko.orders.detail.labelWaybill}>
                {order.waybillNumber ? (
                  <span className="font-mono tracking-wide">{order.waybillNumber}</span>
                ) : (
                  <span className="text-text-tertiary">{ko.orders.detail.noWaybill}</span>
                )}
              </KV>
            </dl>
          </section>

          {/* 타임라인 */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-text">
              {ko.orders.detail.sectionTimeline}
            </h2>
            <OrderStatusTimeline order={order} />
          </section>
        </div>

        {/* Right column */}
        <aside className="flex flex-col gap-4">
          {/* 수동 입력 카드 */}
          <section
            className={cn(
              'rounded-2xl border bg-surface p-5 shadow-sm',
              isFailure ? 'border-danger ring-4 ring-danger/10' : 'border-border',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white',
                  isFailure ? 'bg-danger' : 'bg-text-tertiary',
                )}
              >
                !
              </span>
              <h3 className="text-sm font-bold text-text">
                {ko.orders.detail.manualResolveCta}
              </h3>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-text-secondary">
              {ko.orders.detail.manualResolveHint}
            </p>
            <OrderManualResolveDialog order={order} />
          </section>

          {/* 마켓 송장 제출 */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-text">
              {ko.orders.detail.sectionDispatch}
            </h3>
            <div className="flex items-center gap-3 py-2">
              <MarketBadge marketId={order.marketId} size="md" />
              <span className="flex-1 truncate text-sm font-semibold text-text">
                {ko.market[order.marketId]}
              </span>
              <DispatchPill status={order.marketDispatchStatus} />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-text-tertiary">
              {ko.orders.detail.dispatchHint}
            </p>
          </section>

          <BackLink />
        </aside>
      </div>
    </DetailShell>
  )
}

function DetailShell({
  children,
  role,
  ariaLabel,
}: {
  children: React.ReactNode
  role?: 'status'
  ariaLabel?: string
}): JSX.Element {
  return (
    <div
      className="mx-auto w-full max-w-[1200px]"
      {...(role ? { role } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel, 'aria-live': 'polite' as const } : {})}
    >
      {children}
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

function BackLink(): JSX.Element {
  return (
    <Button asChild variant="ghost" size="md">
      <Link to="/orders/list">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {ko.orders.detail.backToList}
      </Link>
    </Button>
  )
}

function KV({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  )
}

function DispatchPill({ status }: { status: MarketDispatchStatus }): JSX.Element {
  const tone = DISPATCH_TONE[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tone.wrap,
      )}
    >
      <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', tone.dot)} />
      {ko.orders.dispatch[tone.label]}
    </span>
  )
}

export default OrderDetailPage
