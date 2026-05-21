import { Link } from 'react-router-dom'
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { ko } from '@/locales/ko'
import type { MarketOrderItem } from '@/lib/schemas/dashboard-summary'
import { MarketLogo } from './MarketLogo'

interface MarketOrderItemCardProps {
  item: MarketOrderItem
}

/**
 * 단일 마켓 주문 row — s2 대시보드 "마켓별 주문 현황" 위젯 내부.
 * 마스터: docs/design-renewal/s2-dashboard.md §3.4 / §6.1 / §6.3
 * 디자인: docs/design-renewal/designFile/concepts/studio.jsx (마켓 연결 list pattern)
 *
 * Studio 룩 (vertical list row):
 *   logo(initial 박스) + 마켓명 + 우측 mini stats (신규/오늘) + sync 상태 + 화살표
 *
 * sync 오류 row 는 좌측 컬러바 강조 + /markets 재인증 유도.
 * 신규 0 row 는 dim 처리.
 */
export function MarketOrderItemCard({ item }: MarketOrderItemCardProps): JSX.Element {
  const marketLabel = ko.market[item.marketId]
  const hasNew = item.newOrdersCount > 0
  const isError = item.syncStatus === 'error'
  const isSyncing = item.syncStatus === 'syncing'

  // 오류 시 /markets 로 재인증 유도, 그 외엔 /orders/list?market=<id>.
  const to = isError
    ? `/markets`
    : `/orders/list?market=${encodeURIComponent(item.marketId)}`
  const aria = isError
    ? `${marketLabel} 연결 오류, 재인증 페이지로 이동`
    : `${marketLabel} 신규 ${item.newOrdersCount}건, 오늘 ${item.todayTotalCount}건, 주문 목록으로 이동`

  return (
    <Link
      to={to}
      aria-label={aria}
      data-market={item.marketId}
      data-sync-status={item.syncStatus}
      className={[
        'group relative flex items-center gap-3 rounded-[10px] border px-3 py-3 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        isError
          ? 'border-danger/30 bg-danger-soft hover:bg-danger-soft/80'
          : hasNew
            ? 'border-border bg-white hover:bg-card-2'
            : 'border-border bg-card-2 hover:bg-white',
      ].join(' ')}
    >
      <MarketLogo id={item.marketId} size="md" label={marketLabel} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {marketLabel}
          </span>
          <SyncBadge status={item.syncStatus} />
        </div>
        <div className="mt-0.5 text-[11.5px] text-faint">
          {isError
            ? '연결 오류 — 재인증 필요'
            : item.lastSyncedAt
              ? `최근 동기화 ${formatRelativeShort(item.lastSyncedAt)}`
              : '동기화 기록 없음'}
        </div>
      </div>
      <div className="flex shrink-0 items-baseline gap-3 text-right">
        <div>
          <div
            className={[
              'font-mono text-[20px] font-bold leading-none tabular-nums tracking-[-0.02em]',
              hasNew ? 'text-ink' : 'text-faint',
            ].join(' ')}
          >
            {item.newOrdersCount}
          </div>
          <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
            신규
          </div>
        </div>
        <div>
          <div className="font-mono text-[15px] font-semibold leading-none tabular-nums text-dim">
            {item.todayTotalCount}
          </div>
          <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-faint">
            오늘
          </div>
        </div>
      </div>
      <ChevronRight
        aria-hidden
        className={[
          'h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5',
          isError ? 'text-danger' : 'text-faint',
          isSyncing ? 'opacity-50' : '',
        ].join(' ')}
      />
    </Link>
  )
}

function SyncBadge({ status }: { status: MarketOrderItem['syncStatus'] }): JSX.Element | null {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10.5px] font-semibold text-danger">
        <AlertCircle className="h-3 w-3" aria-hidden />
        오류
      </span>
    )
  }
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10.5px] font-semibold text-info">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        동기화 중
      </span>
    )
  }
  return null
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
