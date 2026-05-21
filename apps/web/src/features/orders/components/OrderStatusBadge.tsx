import { Badge, type BadgeProps } from '@/components/ui'
import { ko } from '@/locales/ko'
import type { OrderShippingStatus } from '@/lib/schemas/orders'

/**
 * 배송 상태 배지.
 * 색상에만 의존하지 말 것 — 한글 텍스트 동반 (WCAG 2.1 AA, ui-system.md §10).
 */
const VARIANT_MAP: Record<OrderShippingStatus, BadgeProps['variant']> = {
  collected: 'default',
  logen_registered: 'info',
  logen_failed: 'danger',
  waybill_printed: 'success',
  tracking_submitted: 'success',
}

interface OrderStatusBadgeProps {
  status: OrderShippingStatus
  size?: BadgeProps['size']
}

export function OrderStatusBadge({ status, size }: OrderStatusBadgeProps): JSX.Element {
  return (
    <Badge variant={VARIANT_MAP[status]} {...(size ? { size } : {})}>
      {ko.orders.timeline[status]}
    </Badge>
  )
}
