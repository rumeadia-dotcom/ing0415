import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { fetchOrderDetail, ordersQueryKeys } from '../api/orders-api'
import type { OrderDetail } from '@/lib/schemas/orders'

/**
 * 주문 상세 (n49) + Realtime 1채널 (orders:id=eq.<orderId>).
 *
 * 마스터: docs/architecture/v1/features/orders.md §3.3 (PR2 신설).
 */
export function useOrderDetail(orderId: string | null | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!orderId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`orders_detail:${orderId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          logger.debug({ orderId }, 'realtime: orders (detail)')
          void qc.invalidateQueries({ queryKey: ordersQueryKeys.detail(orderId) })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, qc])

  return useQuery<OrderDetail | null>({
    queryKey: orderId ? ordersQueryKeys.detail(orderId) : ['orders', 'detail', 'noop'],
    queryFn: () => (orderId ? fetchOrderDetail(orderId) : Promise.resolve(null)),
    enabled: !!orderId,
    staleTime: 10_000,
  })
}
