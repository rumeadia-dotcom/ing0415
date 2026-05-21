import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/lib/schemas/common'
import type { MarketOrderItem } from '@/lib/schemas/dashboard-summary'

/** 마켓 brand color (MarketDotStack 과 동일 - markets.md §7.2). */
const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

interface MarketOrderItemCardProps {
  item: MarketOrderItem
}

/**
 * 단일 마켓 주문 카드 — s2 대시보드 "마켓별 주문 현황" 위젯 내부.
 * 마스터: docs/design-renewal/s2-dashboard.md §3.4 / §6.1 / §6.3.
 *
 * 시각 hierarchy:
 *   ① 색상 도트 + 마켓명
 *   ② 신규 주문 카운트 (큰 숫자) — 가중치 최고
 *   ③ 오늘 총합 (보조 숫자)
 *   ④ 마지막 sync 시각 + 상태 뱃지 (작은 글자)
 *
 * sync 오류 카드는 좌측 컬러바 강조 + 재인증 유도 (`/markets`).
 * 신규 0건 카드는 dim 처리 (지금 처리할 일이 없는 마켓).
 */
export function MarketOrderItemCard({ item }: MarketOrderItemCardProps): JSX.Element {
  const marketLabel = ko.market[item.marketId]
  const hasNew = item.newOrdersCount > 0
  const isError = item.syncStatus === 'error'
  const isSyncing = item.syncStatus === 'syncing'

  const content = (
    <Card
      data-market={item.marketId}
      data-sync-status={item.syncStatus}
      className={[
        'relative h-full overflow-hidden transition-shadow',
        isError ? 'border-danger' : '',
        hasNew ? 'shadow-sm' : 'opacity-75',
        'group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-accent',
      ].join(' ')}
    >
      {/* 좌측 컬러바 */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: isError ? undefined : BRAND_COLOR[item.marketId] }}
      />
      <CardContent className="flex min-h-[88px] flex-col gap-2 py-4 pl-5 pr-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BRAND_COLOR[item.marketId] }}
            />
            <span className="text-sm font-medium text-text">{marketLabel}</span>
          </div>
          <SyncBadge status={item.syncStatus} />
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={[
              'text-[28px] leading-none font-semibold tabular-nums',
              hasNew ? 'text-text' : 'text-text-tertiary',
            ].join(' ')}
          >
            {item.newOrdersCount}
          </span>
          <span className="text-xs text-text-secondary">신규</span>
          <span className="ml-2 text-xs text-text-tertiary">
            오늘 {item.todayTotalCount}건
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>
            {isError
              ? '연결 오류 — 재인증 필요'
              : item.lastSyncedAt
                ? `최근 동기화 ${formatRelativeShort(item.lastSyncedAt)}`
                : '동기화 기록 없음'}
          </span>
          {isError ? (
            <span className="text-danger" aria-hidden>
              →
            </span>
          ) : isSyncing ? null : (
            <span className="text-text-tertiary" aria-hidden>
              →
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )

  // 오류 시 /markets 로 재인증 유도, 그 외엔 /orders/list?market=<id>.
  const to = isError
    ? `/markets`
    : `/orders/list?market=${encodeURIComponent(item.marketId)}`
  const aria = isError
    ? `${marketLabel} 연결 오류, 재인증 페이지로 이동`
    : `${marketLabel} 주문 ${item.newOrdersCount}건, 목록으로 이동`

  return (
    <Link
      to={to}
      aria-label={aria}
      className="group block rounded-md focus-visible:outline-none"
    >
      {content}
    </Link>
  )
}

function SyncBadge({ status }: { status: MarketOrderItem['syncStatus'] }): JSX.Element {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
        <AlertCircle className="h-3 w-3" aria-hidden />
        오류
      </span>
    )
  }
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info-on-soft">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        동기화 중
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-on-soft">
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      정상
    </span>
  )
}

/** 상대 시간 짧은 포맷 — "방금 / N분 전 / N시간 전 / N일 전". */
function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  if (diff < 60_000) return '방금'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return `${d}일 전`
}
