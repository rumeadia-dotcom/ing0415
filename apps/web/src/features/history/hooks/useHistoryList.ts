import { useEffect } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import { fetchHistoryList, historyQueryKeys, type HistoryListPage } from '../api/history-api'
import type { HistoryFilter } from '@/lib/schemas/history-filter'

/**
 * 이력 목록 (무한 스크롤 / keyset cursor).
 * - useInfiniteQuery: getNextPageParam = page.nextCursor
 * - Realtime: registration_jobs:seller_id=eq.<sellerId> INSERT/UPDATE → 첫 페이지 invalidate
 * 마스터: docs/architecture/v1/features/history.md §3.2 / §6.
 */
export function useHistoryList(filter: HistoryFilter) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`history_list:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'registration_jobs',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: registration_jobs (history list)')
          void qc.invalidateQueries({ queryKey: historyQueryKeys.all })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc])

  return useInfiniteQuery<
    HistoryListPage,
    Error,
    InfiniteData<HistoryListPage>,
    readonly unknown[],
    { cursor: string; cursorId: string } | null
  >({
    queryKey: historyQueryKeys.list(filter),
    queryFn: ({ pageParam }) =>
      fetchHistoryList({
        ...filter,
        ...(pageParam
          ? { cursor: pageParam.cursor, cursorId: pageParam.cursorId }
          : {}),
      }),
    enabled: !!sellerId,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 15_000,
  })
}
