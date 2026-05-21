import { Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'
import { formatRelativeTime } from '@/lib/format-time'
import type { OrderDetail, OrderShippingStatus } from '@/lib/schemas/orders'

/**
 * 배송 진행 상태 타임라인 (n49) — Studio 룩 가로형 4단계.
 *
 * 흐름: collected → logen_registered → waybill_printed → tracking_submitted.
 * logen_failed 분기는 logen_registered 자리에 경고 아이콘으로 표시.
 *
 * a11y: ol > li 구조 + 각 단계 aria-current="step" 으로 현재 위치 명시.
 * 모바일(<sm)은 세로 stack 으로 fallback.
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

  const currentIdx = (() => {
    if (failedAtLogen) return STEP_ORDER.indexOf('logen_registered')
    const firstUnreached = steps.findIndex((s) => !s.reached)
    return firstUnreached === -1 ? steps.length - 1 : Math.max(0, firstUnreached - 1)
  })()

  return (
    <ol
      className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0"
      aria-label={ko.orders.detail.sectionTimeline}
    >
      {steps.map((s, idx) => {
        const isCurrent = idx === currentIdx
        const isReached = s.reached
        const isFailed = s.failed
        const label = isFailed ? ko.orders.timeline.logen_failed : ko.orders.timeline[s.key]
        const nextReached = idx < steps.length - 1 ? steps[idx + 1]?.reached ?? false : false
        return (
          <li
            key={s.key}
            {...(isCurrent ? { 'aria-current': 'step' as const } : {})}
            className="relative flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center"
          >
            {/* 연결선 (sm+, 다음 단계로) */}
            {idx < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-4 top-8 hidden h-px sm:left-[calc(50%+18px)] sm:right-[calc(-50%+18px)] sm:top-4 sm:block',
                  nextReached ? 'bg-success' : 'bg-border',
                )}
              />
            ) : null}

            {/* 마커 */}
            <span
              aria-hidden
              className={cn(
                'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold',
                isFailed
                  ? 'bg-danger text-white'
                  : isReached
                    ? 'bg-success text-white'
                    : 'border-[1.5px] border-dashed border-border-strong bg-surface-muted text-text-tertiary',
              )}
            >
              {isFailed ? (
                <AlertTriangle className="h-4 w-4" />
              ) : isReached ? (
                <Check className="h-4 w-4" />
              ) : (
                idx + 1
              )}
            </span>

            <div className="min-w-0 flex-1 sm:mt-2.5 sm:flex-none">
              <div
                className={cn(
                  'text-sm font-bold',
                  isReached || isFailed ? 'text-text' : 'text-text-tertiary',
                )}
              >
                {label}
              </div>
              {s.timestamp ? (
                <div className="mt-0.5 text-[11px] text-text-tertiary">
                  {formatRelativeTime(s.timestamp)}
                </div>
              ) : !isReached ? (
                <div className="mt-0.5 text-[11px] text-text-tertiary">
                  {ko.orders.detail.timelinePending}
                </div>
              ) : null}
              {isFailed && order.logenErrorMessage ? (
                <div className="mt-1 text-[11px] text-danger-on-soft">
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
