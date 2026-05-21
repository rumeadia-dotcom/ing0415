import { Badge } from '@/components/ui'
import type {
  ShippingJobStatus,
  ShippingMarketResultStatus,
} from '../types/shipping-schema'

const JOB_LABEL: Record<ShippingJobStatus, string> = {
  pending: '대기',
  running: '진행 중',
  partial: '부분 성공',
  succeeded: '성공',
  failed: '실패',
  cancelled: '취소됨',
}

const JOB_VARIANT: Record<ShippingJobStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'default',
  running: 'default',
  partial: 'warning',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'default',
}

interface ShippingJobStatusBadgeProps {
  status: ShippingJobStatus
}

export function ShippingJobStatusBadge({ status }: ShippingJobStatusBadgeProps): JSX.Element {
  return <Badge variant={JOB_VARIANT[status]}>{JOB_LABEL[status]}</Badge>
}

const RESULT_LABEL: Record<ShippingMarketResultStatus, string> = {
  pending: '대기',
  in_flight: '진행 중',
  success: '성공',
  failed: '실패',
  failed_final: '실패 (최종)',
}

const RESULT_VARIANT: Record<
  ShippingMarketResultStatus,
  'default' | 'success' | 'warning' | 'danger'
> = {
  pending: 'default',
  in_flight: 'default',
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
  return <Badge variant={RESULT_VARIANT[status]}>{RESULT_LABEL[status]}</Badge>
}
