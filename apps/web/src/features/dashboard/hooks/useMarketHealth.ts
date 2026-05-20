import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { useAuth } from '@/features/auth'
import { dashboardQueryKeys, fetchMarketHealth } from '../api/dashboard-api'
import type { MarketHealth } from '@/lib/schemas/dashboard-summary'

/**
 * 마켓 연결 건강 상태 카드.
 * - useQuery (staleTime 60s — 변동 빈도 낮음)
 * - Realtime: market_accounts:seller_id=eq.<sellerId> UPDATE 시 invalidate.
 */
export function useMarketHealth() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`dashboard_market_health:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'market_accounts',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: market_accounts (health)')
          void qc.invalidateQueries({ queryKey: dashboardQueryKeys.marketHealth() })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc])

  return useQuery<MarketHealth>({
    queryKey: dashboardQueryKeys.marketHealth(),
    queryFn: fetchMarketHealth,
    enabled: !!sellerId,
    staleTime: 60_000,
  })
}
