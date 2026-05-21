import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Button,
  ErrorMessage,
  Input,
  Skeleton,
} from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
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
 * - URL search params 로 필터 상태 보존 (market / status / q)
 * - shadcn Table 대체: HistoryListTable 패턴 따라 native <table> + Tailwind
 *   (shadcn 에 Table 미보유. 페르소나 룰 4 의 "특수 케이스" 명시 — 본 PR 사유: shadcn 미제공)
 * - 4상태: loading / data / error / empty
 * - 무한 스크롤 (IntersectionObserver)
 *
 * 마스터: docs/architecture/v1/features/orders.md §3.2 + history.md §3.2 (테이블 패턴 재사용).
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

      {/* 필터 영역 */}
      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <form onSubmit={onSubmitSearch} className="flex items-end gap-2">
          <div className="flex-1">
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
        </form>

        <FilterChips
          label={ko.orders.list.filterMarket}
          options={[
            { value: '', label: ko.orders.list.filterAll },
            ...MARKET_IDS.map((id) => ({ value: id, label: ko.market[id] })),
          ]}
          value={filter.marketId ?? ''}
          onChange={(v) => setParam('market', v || null)}
        />

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

        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onResetFilter}
          disabled={isFilterDefault && searchInput === ''}
        >
          {ko.orders.list.filterReset}
        </Button>
      </div>

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
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-secondary">
          {isFilterDefault ? ko.orders.list.emptyAbsolute : ko.orders.list.empty}
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden md:block">
            <table
              className="w-full table-fixed border-collapse"
              aria-label={ko.orders.list.title}
            >
              <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th scope="col" className="p-3 font-semibold w-[34%]">
                    {ko.orders.list.tableProduct}
                  </th>
                  <th scope="col" className="p-3 font-semibold w-[12%]">
                    {ko.orders.list.tableMarket}
                  </th>
                  <th scope="col" className="p-3 font-semibold w-[14%]">
                    {ko.orders.list.tableBuyer}
                  </th>
                  <th scope="col" className="p-3 font-semibold w-[14%]">
                    {ko.orders.list.tableStatus}
                  </th>
                  <th scope="col" className="p-3 font-semibold w-[14%]">
                    {ko.orders.list.tableWaybill}
                  </th>
                  <th scope="col" className="p-3 font-semibold w-[12%]">
                    {ko.orders.list.tableOrderedAt}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border transition-colors hover:bg-surface-muted focus-within:bg-surface-muted"
                  >
                    <td className="p-3">
                      <Link
                        to={`/orders/${o.id}`}
                        className="block truncate text-sm text-text hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {o.productName}
                      </Link>
                      <div className="text-xs text-text-tertiary">
                        #{o.externalOrderId}
                      </div>
                    </td>
                    <td className="p-3">
                      <MarketBadge marketId={o.marketId} />
                    </td>
                    <td className="p-3 text-sm text-text">{o.buyerMaskedName}</td>
                    <td className="p-3">
                      <OrderStatusBadge status={o.shippingStatus} size="sm" />
                    </td>
                    <td className="p-3 text-xs text-text">
                      {o.waybillNumber ?? '—'}
                    </td>
                    <td className="p-3 text-xs text-text-tertiary">
                      {formatRelativeTime(o.orderedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="space-y-2 md:hidden">
            {items.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">
                      {o.productName}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      #{o.externalOrderId} · {o.buyerMaskedName}
                    </div>
                  </div>
                  <OrderStatusBadge status={o.shippingStatus} size="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <MarketBadge marketId={o.marketId} />
                  <span className="text-xs text-text-tertiary">
                    {formatRelativeTime(o.orderedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

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
    <fieldset className="grid gap-1">
      <legend className="text-xs font-medium text-text-secondary">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = o.value === value
          return (
            <Button
              key={o.value || 'all'}
              type="button"
              variant={active ? 'outline' : 'ghost'}
              size="sm"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={active ? 'border-accent text-accent' : undefined}
            >
              {o.label}
            </Button>
          )
        })}
      </div>
    </fieldset>
  )
}

export default OrdersListPage
