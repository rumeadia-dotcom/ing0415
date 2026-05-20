import { useQuery } from '@tanstack/react-query'
import { fetchMarketCategoryTree } from '../api/category-api'
import type { CategoryNode, MarketId } from '@/lib/schemas'

export function useMarketCategoryTree(marketId: MarketId | null) {
  return useQuery<CategoryNode[]>({
    queryKey: ['registration', 'category-tree', marketId],
    queryFn: () => {
      if (!marketId) throw new Error('marketId required')
      return fetchMarketCategoryTree(marketId)
    },
    enabled: marketId != null,
    staleTime: 60 * 60 * 1000, // 1h — 카테고리 트리는 변동 적음
  })
}
