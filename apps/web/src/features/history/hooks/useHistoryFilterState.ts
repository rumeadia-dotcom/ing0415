import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  historyFilterFromSearchParams,
  historyFilterToSearchParams,
  type HistoryFilter,
} from '@/lib/schemas/history-filter'

/**
 * URL ↔ HistoryFilter state 동기화.
 * - 마운트 시 URL → filter
 * - setFilter(next) → URL 갱신 (replace, 페이지 리렌더 한 번에)
 * 마스터: docs/architecture/v1/features/history.md §5.
 */
export function useHistoryFilterState(): {
  filter: HistoryFilter
  setFilter: (next: HistoryFilter) => void
  resetFilter: () => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const filter = useMemo(() => historyFilterFromSearchParams(searchParams), [searchParams])

  const setFilter = useCallback(
    (next: HistoryFilter) => {
      setSearchParams(historyFilterToSearchParams(next), { replace: true })
    },
    [setSearchParams],
  )

  const resetFilter = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  return { filter, setFilter, resetFilter }
}
