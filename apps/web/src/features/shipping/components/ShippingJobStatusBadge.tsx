import { cn } from '@/lib/utils'
import type {
  ShippingJobStatus,
  ShippingMarketResultStatus,
} from '../types/shipping-schema'

/**
 * Studio 룩 dot-pill — 색에만 의존하지 말 것 (한글 + dot 동반, WCAG 2.1 AA).
 */

type Tone = 'muted' | 'info' | 'success' | 'warning' | 'danger'

const TONE_CLASS: Record<Tone, { wrap: string; dot: string }> = {
  muted: { wrap: 'bg-surface-muted text-text-secondary', dot: 'bg-text-tertiary' },
  info: { wrap: 'bg-info-soft text-info-on-soft', dot: 'bg-info' },
  success: { wrap: 'bg-success-soft text-success-on-soft', dot: 'bg-success' },
  warning: { wrap: 'bg-warning-soft text-warning-on-soft', dot: 'bg-warning' },
  danger: { wrap: 'bg-danger-soft text-danger-on-soft', dot: 'bg-danger' },
}

function Pill({ tone, label }: { tone: Tone; label: string }): JSX.Element {
  const c = TONE_CLASS[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        c.wrap,
      )}
    >
      <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', c.dot)} />
      {label}
    </span>
  )
}

const JOB_LABEL: Record<ShippingJobStatus, string> = {
  pending: '대기',
  running: '진행 중',
  partial: '부분 성공',
  succeeded: '성공',
  failed: '실패',
  cancelled: '취소됨',
}

const JOB_TONE: Record<ShippingJobStatus, Tone> = {
  pending: 'muted',
  running: 'info',
  partial: 'warning',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'muted',
}

interface ShippingJobStatusBadgeProps {
  status: ShippingJobStatus
}

export function ShippingJobStatusBadge({
  status,
}: ShippingJobStatusBadgeProps): JSX.Element {
  return <Pill tone={JOB_TONE[status]} label={JOB_LABEL[status]} />
}

const RESULT_LABEL: Record<ShippingMarketResultStatus, string> = {
  pending: '대기',
  in_flight: '진행 중',
  success: '성공',
  failed: '실패',
  failed_final: '실패 (최종)',
}

const RESULT_TONE: Record<ShippingMarketResultStatus, Tone> = {
  pending: 'muted',
  in_flight: 'info',
  success: 'success',
  failed: 'danger',
  failed_final: 'danger',
}

interface ShippingMarketResultBadgeProps {
  status: ShippingMarketResultStatus
}

export function ShippingMarketResultBadge({
  status,
}: ShippingMarketResultBadgeProps): JSX.Element {
  return <Pill tone={RESULT_TONE[status]} label={RESULT_LABEL[status]} />
}
