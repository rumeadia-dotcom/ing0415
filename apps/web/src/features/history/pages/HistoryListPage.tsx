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
        subtitle={
          listState === 'data'
            ? `총 ${totalCount.toLocaleString()}건 / 표시 중 ${allItems.length.toLocaleString()}건`
            : '등록 작업 목록과 결과를 확인합니다'
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="필터">
          <HistoryFilterSidebar filter={filter} onChange={setFilter} onReset={resetFilter} />
        </aside>
        <section aria-label="목록">
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
