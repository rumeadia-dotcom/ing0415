import { Badge } from '@/components/ui'
import type { MarketAccountStatus } from '@/lib/schemas/markets-feature'

const STATUS_LABEL: Record<MarketAccountStatus, string> = {
  active: '활성',
  expired: '재인증 필요',
  revoked: '해제됨',
  error: '오류',
}

const STATUS_VARIANT: Record<MarketAccountStatus, 'success' | 'warning' | 'default' | 'danger'> = {
  active: 'success',
  expired: 'warning',
  revoked: 'default',
  error: 'danger',
}

/**
 * markets.md §7.1 의 status 뱃지 매핑.
 */
export function MarketAccountStatusBadge({ status }: { status: MarketAccountStatus }): JSX.Element {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
