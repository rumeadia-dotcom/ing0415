import { Link, useParams } from 'react-router-dom'
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
import { useOrderDetail } from '../hooks/useOrderDetail'
import { OrderStatusTimeline } from '../components/OrderStatusTimeline'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { MarketBadge } from '../components/MarketBadge'
import { OrderManualResolveDialog } from '../components/OrderManualResolveDialog'
import { formatRelativeTime } from '@/lib/format-time'
import type { MarketDispatchStatus } from '@/lib/schemas/orders'

const DISPATCH_VARIANT: Record<MarketDispatchStatus, 'default' | 'success' | 'danger'> = {
  pending: 'default',
  submitted: 'success',
  failed: 'danger',
}

/**
 * OrderDetailPage — n49 (/orders/:orderId).
 *
 * 구성:
 *  - PageHeader (상품명 + 외부 주문 ID)
 *  - 주문 정보 카드
 *  - 배송 정보 카드
 *  - 타임라인 (collected → logen_registered → waybill_printed → tracking_submitted)
 *  - 마켓 송장 제출 상태 + 운송장번호
 *  - 액션: 수동 입력 다이얼로그 (logen_failed 일 때만 활성)
 *
 * 4상태: loading / data / error / empty(notFound).
 */
export function OrderDetailPage(): JSX.Element {
  const { orderId } = useParams<{ orderId: string }>()
  const { data, isLoading, isError, error } = useOrderDetail(orderId)

  if (!orderId) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <PageHeader title={ko.orders.detail.title} subtitle={ko.orders.detail.notFound} />
        <Card>
          <CardContent className="py-6">
            <Button asChild variant="ghost">
              <Link to="/orders/list">{ko.orders.detail.backToList}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="mx-auto flex w-full max-w-[960px] flex-col gap-4"
        role="status"
        aria-live="polite"
        aria-label="주문 상세 불러오는 중"
      >
        <PageHeader title={ko.orders.detail.title} subtitle={ko.orders.detail.subtitleFallback} />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <PageHeader title={ko.orders.detail.title} subtitle={`Order ID: ${orderId}`} />
        <Card>
          <CardContent className="py-6">
            <ErrorMessage
              message={ko.orders.detail.errorLoad}
              {...(error instanceof Error ? { details: error.message } : {})}
            />
            <div className="mt-3">
              <Button asChild variant="ghost">
                <Link to="/orders/list">{ko.orders.detail.backToList}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <PageHeader title={ko.orders.detail.title} subtitle={ko.orders.detail.notFound} />
        <Card>
          <CardContent className="py-6 text-sm text-text-secondary">
            <p>{ko.orders.detail.notFound}</p>
            <div className="mt-3">
              <Button asChild variant="ghost">
                <Link to="/orders/list">{ko.orders.detail.backToList}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { order } = data

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <PageHeader
        title={order.productName}
        subtitle={`#${order.externalOrderId}`}
        actions={
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.shippingStatus} />
            <OrderManualResolveDialog order={order} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{ko.orders.detail.sectionOrder}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            <KeyValue label={ko.orders.detail.labelExternalOrderId} value={order.externalOrderId} />
            <KeyValue
              label={ko.orders.detail.labelMarket}
              value={<MarketBadge marketId={order.marketId} />}
            />
            <KeyValue label={ko.orders.detail.labelProduct} value={order.productName} />
            {order.productOption ? (
              <KeyValue
                label={ko.orders.detail.labelOption}
                value={order.productOption}
              />
            ) : null}
            <KeyValue
              label={ko.orders.detail.labelQuantity}
              value={`${order.quantity.toLocaleString()}개`}
            />
            <KeyValue
              label={ko.orders.detail.labelOrderedAt}
              value={formatRelativeTime(order.orderedAt)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{ko.orders.detail.sectionShipping}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            <KeyValue label={ko.orders.detail.labelBuyer} value={order.buyerMaskedName} />
            {order.buyerMaskedPhone ? (
              <KeyValue
                label={ko.orders.detail.labelBuyerPhone}
                value={order.buyerMaskedPhone}
              />
            ) : null}
            <KeyValue
              label={ko.orders.detail.labelAddress}
              value={order.shippingAddressMasked}
            />
            <KeyValue
              label={ko.orders.detail.labelWaybill}
              value={order.waybillNumber ?? ko.orders.detail.noWaybill}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ko.orders.detail.sectionTimeline}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusTimeline order={order} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{ko.orders.detail.sectionDispatch}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">
              {ko.orders.detail.labelDispatchStatus}:
            </span>
            <Badge variant={DISPATCH_VARIANT[order.marketDispatchStatus]} size="sm">
              {ko.orders.dispatch[order.marketDispatchStatus]}
            </Badge>
          </div>
          {order.shippingStatus === 'logen_failed' ? (
            <p className="mt-2 text-xs text-text-secondary">
              {ko.orders.detail.manualResolveHint}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <Button asChild variant="ghost">
          <Link to="/orders/list">{ko.orders.detail.backToList}</Link>
        </Button>
      </div>
    </div>
  )
}

function KeyValue({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}): JSX.Element {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
      <div className="text-xs text-text-tertiary">{label}</div>
      <div className="text-sm text-text">{value}</div>
    </div>
  )
}

export default OrderDetailPage
