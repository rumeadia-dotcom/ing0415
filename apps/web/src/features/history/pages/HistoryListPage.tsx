import { useMemo } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useHistoryFilterState } from '../hooks/useHistoryFilterState'
import { useHistoryList } from '../hooks/useHistoryList'
import { HistoryFilterSidebar } from '../components/HistoryFilterSidebar'
import { HistoryListTable } from '../components/HistoryListTable'
import { HistoryEmptyState } from '../components/HistoryEmptyState'

/**
 * HistoryListPage — n41 / n42 (목록 + 4종 필터 + 무한 스크롤).
 * 마스터: docs/architecture/v1/features/history.md.
 * 디자인 ref: docs/design-renewal/designFile/concepts/studio-domains.jsx (s6).
 */
export function HistoryListPage(): JSX.Element {
  const { filter, setFilter, resetFilter } = useHistoryFilterState()
  const query = useHistoryList(filter)

  const allItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  )
  const totalCount = query.data?.pages[0]?.totalCount ?? 0

  const isFilterDefault =
    filter.period === '30d' &&
    !filter.from &&
    !filter.to &&
    !filter.markets &&
    !filter.statuses &&
    !filter.q

  let listState: 'loading' | 'data' | 'error' | 'empty'
  if (query.isLoading) listState = 'loading'
  else if (query.isError) listState = 'error'
  else if (allItems.length === 0) listState = 'empty'
  else listState = 'data'

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="등록 이력"
        subtitle="필터로 좁혀 검색 · 실패 잡은 재시도 / 마켓 제외 후 재등록"
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="필터" className="md:sticky md:top-4 md:self-start">
          <HistoryFilterSidebar
            filter={filter}
            onChange={setFilter}
            onReset={resetFilter}
          />
        </aside>

        <section aria-label="목록" className="flex min-w-0 flex-col gap-3">
          {/* List meta bar — Studio: count + (placeholder CSV) */}
          <div className="flex items-center justify-between gap-3 text-xs">
            {listState === 'data' ? (
              <span className="font-mono tabular-nums text-text-secondary">
                {`총 ${totalCount.toLocaleString()}건 · 표시 중 ${allItems.length.toLocaleString()}건`}
              </span>
            ) : (
              <span className="text-text-tertiary">등록 이력 조회</span>
            )}
            {/* v2 carry-over — CSV 내보내기 placeholder (s6-history.md §7) */}
            <span
              className="rounded-md border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-text-tertiary"
              title="v2 출시 예정"
            >
              CSV 내보내기 (v2)
            </span>
          </div>

          {listState === 'empty' ? (
            <HistoryEmptyState
              isAbsoluteEmpty={isFilterDefault}
              onResetFilter={resetFilter}
            />
          ) : (
            <HistoryListTable
              state={listState}
              jobs={allItems}
              hasNextPage={query.hasNextPage ?? false}
              isFetchingNextPage={query.isFetchingNextPage}
              onLoadMore={() => {
                void query.fetchNextPage()
              }}
              errorMessage={query.error?.message}
            />
          )}
        </section>
      </div>
    </div>
  )
}

export default HistoryListPage
