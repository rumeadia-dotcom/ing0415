import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { listMarketAccounts, marketQueryKeys } from '../api/markets-api'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

/**
 * 셀러의 market_accounts 목록 조회.
 *
 * - RLS 가 seller_id = auth.uid() 적용 → 응답에 자신의 행만.
 * - staleTime 30s (queryClient 기본). 도메인 override 없음.
 * - sellerId 가 없으면 (anonymous) enabled=false 로 호출 자체 차단.
 */
export function useMarketAccounts() {
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useQuery<MarketAccount[]>({
    queryKey: marketQueryKeys.accounts(sellerId),
    queryFn: () => listMarketAccounts(),
    enabled: sellerId != null,
  })
}
