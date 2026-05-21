import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import { fetchOrdersSummary, ordersQueryKeys } from '../api/orders-api'
import type { OrdersSummary } from '@/lib/schemas/orders'

/**
 * 주문 대시보드 요약 (n47).
 * - useQuery (staleTime 30s)
 * - Realtime: orders:seller_id=eq.<sellerId> → summary invalidate.
 *
 * 마스터: docs/architecture/v1/features/orders.md §3.1 (PR2 신설).
 */
export function useOrdersSummary() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`orders_summary:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: orders (summary)')
          void qc.invalidateQueries({ queryKey: ordersQueryKeys.summary() })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc])

  return useQuery<OrdersSummary>({
    queryKey: ordersQueryKeys.summary(),
    queryFn: fetchOrdersSummary,
    enabled: !!sellerId,
    staleTime: 30_000,
  })
}
