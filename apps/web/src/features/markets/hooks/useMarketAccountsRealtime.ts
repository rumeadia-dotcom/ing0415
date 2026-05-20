import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { marketQueryKeys } from '../api/markets-api'

/**
 * market_accounts 테이블의 postgres_changes 구독 → ['markets','accounts'] invalidate.
 * 마스터: docs/architecture/v1/features/markets.md §9
 *
 * - 채널 이름: `market_accounts:<sellerId>`. 셀러 ID URL 노출 없음 (메모리만).
 * - market_credentials / *_audit 테이블은 구독 금지 (service_role only).
 */
export function useMarketAccountsRealtime(sellerId: string | null): void {
  const qc = useQueryClient()

  useEffect(() => {
    if (!sellerId) return
    const supabase = getSupabase()
    const channel = supabase
      .channel(`market_accounts:${sellerId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'market_accounts',
          filter: `seller_id=eq.${sellerId}`,
        },
        () => {
          logger.debug({ sellerId }, 'realtime: market_accounts change')
          void qc.invalidateQueries({ queryKey: marketQueryKeys.accounts(sellerId) })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sellerId, qc])
}
