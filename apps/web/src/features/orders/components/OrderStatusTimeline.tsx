import { Check, AlertTriangle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import { formatRelativeTime } from '@/lib/format-time'
import type { OrderDetail, OrderShippingStatus } from '@/lib/schemas/orders'

/**
 * 배송 진행 상태 타임라인 (n49).
 * 흐름: collected → logen_registered → waybill_printed → tracking_submitted.
 * logen_failed 분기는 logen_registered 자리에 경고 아이콘으로 표시.
 *
 * 마스터: docs/architecture/v1/features/orders.md §4.2 (PR2 신설).
 * a11y: ol > li 구조 + 각 단계 aria-current="step" 으로 현재 위치 명시.
 */

interface TimelineStep {
  key: 'collected' | 'logen_registered' | 'waybill_printed' | 'tracking_submitted'
  reached: boolean
  failed: boolean
  timestamp: string | null
}

interface OrderStatusTimelineProps {
  order: OrderDetail['order']
}

const STEP_ORDER: readonly TimelineStep['key'][] = [
  'collected',
  'logen_registered',
  'waybill_printed',
  'tracking_submitted',
]

function statusReachedFlag(
  current: OrderShippingStatus,
  target: TimelineStep['key'],
): boolean {
  // failed 는 collected 까지만 reached
  if (current === 'logen_failed') return target === 'collected'
  const currentIdx = STEP_ORDER.indexOf(current as TimelineStep['key'])
  const targetIdx = STEP_ORDER.indexOf(target)
  if (currentIdx === -1 || targetIdx === -1) return false
  return currentIdx >= targetIdx
}

export function OrderStatusTimeline({ order }: OrderStatusTimelineProps): JSX.Element {
  const failedAtLogen = order.shippingStatus === 'logen_failed'

  const steps: TimelineStep[] = STEP_ORDER.map((key) => {
    const reached = statusReachedFlag(order.shippingStatus, key)
    const failed = key === 'logen_registered' && failedAtLogen
    const timestamp =
      key === 'collected'
        ? order.collectedAt
        : key === 'logen_registered'
          ? order.logenRegisteredAt
          : key === 'waybill_printed'
            ? order.waybillPrintedAt
            : order.trackingSubmittedAt
    return { key, reached, failed, timestamp }
  })

  return (
    <ol
      className="grid gap-2"
      aria-label={ko.orders.detail.sectionTimeline}
    >
      {steps.map((s, idx) => {
        const isCurrent =
          (s.reached && idx === steps.findIndex((x) => !x.reached) - 1) ||
          (s.failed && order.shippingStatus === 'logen_failed')
        const Icon = s.failed ? AlertTriangle : s.reached ? Check : Circle
        const label = s.failed
          ? ko.orders.timeline.logen_failed
          : ko.orders.timeline[s.key]
        return (
          <li
            key={s.key}
            {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
            className={cn(
              'flex items-start gap-3 rounded-md border px-3 py-2 text-sm',
              s.failed
                ? 'border-danger/40 bg-danger-soft/40 text-danger-on-soft'
                : s.reached
                  ? 'border-success/40 bg-success-soft/40 text-success-on-soft'
                  : 'border-border bg-surface text-text-tertiary',
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{label}</div>
              {s.timestamp ? (
                <div className="text-xs text-text-tertiary">
                  {formatRelativeTime(s.timestamp)}
                </div>
              ) : null}
              {s.failed && order.logenErrorMessage ? (
                <div className="mt-1 text-xs text-danger-on-soft/80">
                  {order.logenErrorMessage}
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
