import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import type { OrderShippingStatus } from '@/lib/schemas/orders'

/**
 * 배송 상태 배지 — Studio 룩 pill (dot + soft bg).
 *
 * 색상에만 의존하지 말 것 — 한글 텍스트 + dot 동반 (WCAG 2.1 AA, ui-system.md §10).
 *
 * 매핑:
 *  - collected → info
 *  - logen_registered → success
 *  - waybill_printed → accent
 *  - tracking_submitted → muted
 *  - logen_failed → danger
 */
type Tone = 'info' | 'success' | 'accent' | 'muted' | 'danger'

const TONE_MAP: Record<OrderShippingStatus, Tone> = {
  collected: 'info',
  logen_registered: 'success',
  logen_failed: 'danger',
  waybill_printed: 'accent',
  tracking_submitted: 'muted',
}

const TONE_CLASS: Record<Tone, { wrap: string; dot: string }> = {
  info: { wrap: 'bg-info-soft text-info-on-soft', dot: 'bg-info' },
  success: { wrap: 'bg-success-soft text-success-on-soft', dot: 'bg-success' },
  accent: { wrap: 'bg-accent-soft text-accent', dot: 'bg-accent' },
  muted: { wrap: 'bg-surface-muted text-text-secondary', dot: 'bg-text-tertiary' },
  danger: { wrap: 'bg-danger-soft text-danger-on-soft', dot: 'bg-danger' },
}

interface OrderStatusBadgeProps {
  status: OrderShippingStatus
  size?: 'sm' | 'md'
  className?: string
}

export function OrderStatusBadge({
  status,
  size = 'sm',
  className,
}: OrderStatusBadgeProps): JSX.Element {
  const tone = TONE_CLASS[TONE_MAP[status]]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tone.wrap,
        className,
      )}
    >
      <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', tone.dot)} />
      {ko.orders.timeline[status]}
    </span>
  )
}
