import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import {
  Button,
  ErrorMessage,
  Input,
  Skeleton,
} from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { MARKET_IDS } from '@/lib/schemas/common'
import {
  ORDER_SHIPPING_STATUSES,
  OrderShippingStatusSchema,
  type OrdersFilter,
} from '@/lib/schemas/orders'
import { MarketIdSchema } from '@/lib/schemas/common'
import { ko } from '@/locales/ko'
import { useOrders } from '../hooks/useOrders'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { MarketBadge } from '../components/MarketBadge'
import { formatRelativeTime } from '@/lib/format-time'

/**
 * OrdersListPage — n48 (/orders/list).
 *
 * Studio 룩 (s7 OrdersList) — 검색·날짜·초기화 행 + 마켓 / 상태 chip 행을 한 카드로 묶고,
 * 본문 테이블에 마켓 컬러 바 + mono 주문번호 + dot pill 상태 + mono 운송장번호를 노출.
 *
 * - URL search params 로 필터 상태 보존 (market / status / q)
 * - shadcn 에 Table 미보유 → native <table> + Tailwind 유지 (페르소나 룰 4 의 "특수 케이스").
 * - 4상태: loading / data / error / empty (필터 적용 시 vs 절대 0건 메시지 분기)
 * - 무한 스크롤 (IntersectionObserver)
 *
 * 마스터: docs/design-renewal/s7-orders.md + design-renewal/designFile/concepts/studio-orders.jsx.
 */
export function OrdersListPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState<string>(searchParams.get('q') ?? '')

  // 필터 (URL 단방향 source)
  const filter = useMemo<OrdersFilter>(() => {
    const marketRaw = searchParams.get('market')
    const statusRaw = searchParams.get('status')
    const q = searchParams.get('q')
    const marketParse = marketRaw ? MarketIdSchema.safeParse(marketRaw) : null
    const statusParse = statusRaw ? OrderShippingStatusSchema.safeParse(statusRaw) : null
    return {
      pageSize: 50,
      ...(marketParse?.success ? { marketId: marketParse.data } : {}),
      ...(statusParse?.success ? { status: statusParse.data } : {}),
      ...(q && q.trim().length > 0 ? { q: q.trim() } : {}),
    }
  }, [searchParams])

  const isFilterDefault = !filter.marketId && !filter.status && !filter.q

  const query = useOrders(filter)

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  )
  const totalCount = query.data?.pages[0]?.totalCount ?? 0

  const state: 'loading' | 'data' | 'error' | 'empty' = query.isLoading
    ? 'loading'
    : query.isError
      ? 'error'
      : items.length === 0
        ? 'empty'
        : 'data'

  // sentinel → 다음 페이지
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const hasNext = query.hasNextPage ?? false
    if (!hasNext) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !query.isFetchingNextPage) {
            void query.fetchNextPage()
          }
        }
      },
      { rootMargin: '160px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [query])

  function setParam(key: string, value: string | null): void {
    const next = new URLSearchParams(searchParams)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  function onResetFilter(): void {
    setSearchInput('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  function onSubmitSearch(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    setParam('q', searchInput.trim() || null)
  }

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title={ko.orders.list.title}
        subtitle={
          state === 'data'
            ? ko.orders.list.totalCount(totalCount)
            : ko.orders.list.subtitle
        }
      />

      {/* 필터 카드 — 검색 + 날짜 자리 + 초기화 / 마켓 chip / 상태 chip */}
      <section className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <form onSubmit={onSubmitSearch} className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="orders-search" className="sr-only">
              {ko.orders.list.searchPlaceholder}
            </label>
            <Input
              id="orders-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={ko.orders.list.searchPlaceholder}
            />
          </div>
          <Button type="submit" variant="outline" size="md">
            검색
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onResetFilter}
            disabled={isFilterDefault && searchInput === ''}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {ko.orders.list.filterReset}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FilterChips
            label={ko.orders.list.filterMarket}
            options={[
              { value: '', label: ko.orders.list.filterAll },
              ...MARKET_IDS.map((id) => ({ value: id, label: ko.market[id] })),
            ]}
            value={filter.marketId ?? ''}
            onChange={(v) => setParam('market', v || null)}
          />

          <span className="h-4 w-px bg-border" aria-hidden />

          <FilterChips
            label={ko.orders.list.filterStatus}
            options={[
              { value: '', label: ko.orders.list.filterAll },
              ...ORDER_SHIPPING_STATUSES.map((s) => ({
                value: s,
                label: ko.orders.timeline[s],
              })),
            ]}
            value={filter.status ?? ''}
            onChange={(v) => setParam('status', v || null)}
          />
        </div>
      </section>

      {/* 목록 */}
      {state === 'loading' ? (
        <div
          className="space-y-2"
          role="status"
          aria-live="polite"
          aria-label={ko.orders.list.loading}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : state === 'error' ? (
        <ErrorMessage
          message={ko.orders.list.errorLoad}
          {...(query.error?.message ? { details: query.error.message } : {})}
        />
      ) : state === 'empty' ? (
        <EmptyState filtered={!isFilterDefault} onReset={onResetFilter} />
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <section className="hidden overflow-hidden rounded-2xl border border-border bg-surface shadow-sm md:block">
            <div
              className="grid items-center gap-3 border-b border-border bg-surface-muted px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
              style={{ gridTemplateColumns: '6px 110px 1fr 110px 110px 150px 80px' }}
              role="row"
            >
              <span aria-hidden />
              <span>{ko.orders.list.tableOrderId}</span>
              <span>{ko.orders.list.tableProductBuyer}</span>
              <span>{ko.orders.list.tableMarket}</span>
              <span>{ko.orders.list.tableStatus}</span>
              <span>{ko.orders.list.tableWaybill}</span>
              <span className="text-right">{ko.orders.list.tableOrderedAt}</span>
            </div>

            <ul aria-label={ko.orders.list.title}>
              {items.map((o, idx) => (
                <li
                  key={o.id}
                  className={cn(
                    'group relative transition-colors hover:bg-surface-muted/60 focus-within:bg-surface-muted/60',
                    idx < items.length - 1 && 'border-b border-border',
                  )}
                >
                  <Link
                    to={`/orders/${o.id}`}
                    className="grid items-center gap-3 px-5 py-3.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                    style={{ gridTemplateColumns: '6px 110px 1fr 110px 110px 150px 80px' }}
                    aria-label={o.productName}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'h-7 w-[3px] rounded-sm',
                        o.marketId === 'naver' && 'bg-market-naver',
                        o.marketId === 'coupang' && 'bg-market-coupang',
                        o.marketId === 'gmarket' && 'bg-market-gmarket',
                        o.marketId === 'auction' && 'bg-market-auction',
                      )}
                    />
                    <span className="font-mono text-[11.5px] text-text-secondary">
                      #{o.externalOrderId}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text">{o.productName}</div>
                      <div className="mt-0.5 text-[11.5px] text-text-tertiary">
                        {o.buyerMaskedName}
                      </div>
                    </div>
                    <MarketBadge marketId={o.marketId} variant="plain" />
                    <OrderStatusBadge status={o.shippingStatus} size="sm" />
                    <span
                      className={cn(
                        'font-mono text-[11.5px]',
                        o.waybillNumber ? 'text-text' : 'text-text-tertiary',
                      )}
                    >
                      {o.waybillNumber ?? '—'}
                    </span>
                    <span className="text-right font-mono text-[11.5px] text-text-tertiary">
                      {formatRelativeTime(o.orderedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 모바일 카드 */}
          <ul className="space-y-2 md:hidden">
            {items.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/orders/${o.id}`}
                  className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={o.productName}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11.5px] text-text-tertiary">
                        #{o.externalOrderId}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-semibold text-text">
                        {o.productName}
                      </div>
                      <div className="mt-0.5 text-xs text-text-tertiary">
                        {o.buyerMaskedName}
                      </div>
                    </div>
                    <OrderStatusBadge status={o.shippingStatus} size="sm" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <MarketBadge marketId={o.marketId} />
                    <span className="font-mono text-[11.5px] text-text-tertiary">
                      {formatRelativeTime(o.orderedAt)}
                    </span>
                  </div>
                  {o.waybillNumber ? (
                    <div className="mt-2 font-mono text-[11.5px] text-text">
                      {o.waybillNumber}
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>

          {/* sentinel */}
          {(query.hasNextPage ?? false) ? (
            <div ref={sentinelRef} className="mt-4 py-4 text-center" aria-hidden>
              {query.isFetchingNextPage ? (
                <Skeleton className="mx-auto h-10 w-32" />
              ) : (
                <span className="text-xs text-text-tertiary">스크롤하여 더 보기</span>
              )}
            </div>
          ) : items.length > 0 ? (
            <div className="mt-4 py-2 text-center text-xs text-text-tertiary">— 끝 —</div>
          ) : null}
        </>
      )}
    </div>
  )
}

interface ChipOption {
  value: string
  label: string
}

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly ChipOption[]
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="float-left mr-2 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
        {label}
      </legend>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              active
                ? 'border-text bg-text text-surface'
                : 'border-border bg-surface text-text-secondary hover:bg-surface-muted',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </fieldset>
  )
}

function EmptyState({
  filtered,
  onReset,
}: {
  filtered: boolean
  onReset: () => void
}): JSX.Element {
  return (
    <section
      className="rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-sm"
      role="status"
    >
      <div
        aria-hidden
        className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-surface-muted text-2xl text-text-tertiary"
      >
        {filtered ? '🔍' : '📦'}
      </div>
      <div className="text-base font-bold text-text">
        {filtered ? ko.orders.list.empty : ko.orders.list.emptyAbsolute}
      </div>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
        {filtered ? ko.orders.list.emptyFilteredHint : ko.orders.list.emptyAbsoluteHint}
      </p>
      {filtered ? (
        <div className="mt-4 flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={onReset}>
            {ko.orders.list.filterReset}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link to="/markets">{ko.orders.list.emptyAbsoluteCta}</Link>
          </Button>
        </div>
      )}
      <p className="mt-4 text-xs text-text-tertiary">{ko.orders.list.emptySyncHint}</p>
    </section>
  )
}

export default OrdersListPage
