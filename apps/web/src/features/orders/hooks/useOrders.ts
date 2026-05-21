import { useEffect } from 'react'
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import {
  fetchOrdersList,
  ordersQueryKeys,
  type OrdersListPage,
} from '../api/orders-api'
import type { OrdersFilter } from '@/lib/schemas/orders'

/**
 * 주문 목록 (n48). 무한 스크롤 (keyset cursor).
 * - Realtime: orders:seller_id=eq.<sellerId> → list invalidate
 *
 * 마스터: docs/architecture/v1/features/orders.md §3.2 (PR2 신설).
 */
export function useOrders(filter: OrdersFilter) {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`orders_list:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: orders (list)')
          void qc.invalidateQueries({ queryKey: ordersQueryKeys.all })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc])

  return useInfiniteQuery<
    OrdersListPage,
    Error,
    InfiniteData<OrdersListPage>,
    readonly unknown[],
    { cursor: string; cursorId: string } | null
  >({
    queryKey: ordersQueryKeys.list(filter),
    queryFn: ({ pageParam }) =>
      fetchOrdersList({
        ...filter,
        ...(pageParam
          ? { cursor: pageParam.cursor, cursorId: pageParam.cursorId }
          : {}),
      }),
    enabled: !!sellerId,
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
  })
}
