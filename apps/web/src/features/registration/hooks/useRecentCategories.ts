import { useQuery } from '@tanstack/react-query'
import { fetchRecentCategories } from '../api/category-api'
import type { CategoryHit, MarketId } from '@/lib/schemas'

/**
 * 마켓별 최근 사용 카테고리 (최신순 6개). 마스터: category-sync.md §6.
 *
 * - enabled = marketId!=='naver'. staleTime 10m(자주 안 바뀜).
 * - Query Key: ['registration','recent-categories', marketId]
 */
export function useRecentCategories(marketId: MarketId | null) {
  const enabled = marketId != null && marketId !== 'naver'
  return useQuery<CategoryHit[]>({
    queryKey: ['registration', 'recent-categories', marketId],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: () => {
      if (!marketId) throw new Error('marketId required')
      return fetchRecentCategories(marketId)
    },
  })
}
