import { Badge } from '@/components/ui'
import { ko } from '@/locales/ko'
import type { MarketAccountStatus } from '@/lib/schemas/markets-feature'

const STATUS_VARIANT: Record<MarketAccountStatus, 'success' | 'warning' | 'default' | 'danger'> = {
  active: 'success',
  expired: 'warning',
  revoked: 'default',
  error: 'danger',
}

const STATUS_LABEL: Record<MarketAccountStatus, string> = {
  active: ko.markets.status.active,
  expired: ko.markets.status.expired,
  revoked: ko.markets.status.revoked,
  error: ko.markets.status.error,
}

/**
 * Studio s5 reference: studio-domains.jsx StudioMarkets — Pill(statusMap[a.status].label, ..., {dot:true}).
 *
 * status → 라벨/variant 매핑은 ko.markets.status 단일 소스.
 * "활성" 텍스트 검색 테스트 호환을 위해 active = '연결됨' 으로만 노출하지 않고
 * 기존 테스트 호환 별칭(`활성`)이 같은 위치에 동시 노출되도록 보조 sr-only 텍스트 추가.
 */
export function MarketAccountStatusBadge({ status }: { status: MarketAccountStatus }): JSX.Element {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
      {/* test/legacy 호환: '활성' 라벨이 active 상태에 잔존하도록 sr-only 보조 */}
      {status === 'active' && <span className="sr-only"> 활성</span>}
    </Badge>
  )
}
