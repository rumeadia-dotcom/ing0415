import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import {
  dashboardQueryKeys,
  fetchMarketOrdersSummary,
} from '../api/dashboard-api'
import type { MarketOrdersSummary } from '@/lib/schemas/dashboard-summary'

/**
 * s2 대시보드 — 마켓별 주문 현황 위젯 데이터 hook.
 * 마스터: docs/design-renewal/s2-dashboard.md §3.5.
 *
 * - staleTime 15s
 * - Realtime: orders + market_accounts 두 채널 구독 (둘 다 invalidate)
 */
export function useMarketOrdersSummary() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const ordersChannel = supabase
      .channel(`dashboard_market_orders_orders:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: orders (dashboard market-orders)')
          void qc.invalidateQueries({ queryKey: dashboardQueryKeys.marketOrders() })
        },
      )
      .subscribe()
    const accountsChannel = supabase
      .channel(`dashboard_market_orders_accounts:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'market_accounts',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug(
            { sellerId },
            'realtime: market_accounts (dashboard market-orders)',
          )
          void qc.invalidateQueries({ queryKey: dashboardQueryKeys.marketOrders() })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ordersChannel)
      void supabase.removeChannel(accountsChannel)
    }
  }, [sellerId, qc])

  return useQuery<MarketOrdersSummary>({
    queryKey: dashboardQueryKeys.marketOrders(),
    queryFn: fetchMarketOrdersSummary,
    enabled: !!sellerId,
    staleTime: 15_000,
  })
}
