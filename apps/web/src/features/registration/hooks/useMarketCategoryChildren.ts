import { useQuery } from '@tanstack/react-query'
import { fetchMarketCategoryChildren } from '../api/category-api'
import type { CategoryNode, MarketId } from '@/lib/schemas'

/**
 * 부모코드 직계 자식 카테고리 lazy 조회 (category-sync.md §6.1).
 *
 * Query Key 규약 `[domain, ...filters]`:
 *   ['registration', 'category-children', marketId, marketAccountId, parentId]
 * staleTime 1h — 카테고리는 변동 적음. 단계별 select 가 parentId 를 바꿔가며 호출.
 * enabled = marketId / marketAccountId 둘 다 존재할 때만.
 * marketAccountId 를 key 에 포함 — 같은 마켓의 계정 전환 시 이전 계정 캐시(에러 포함) 재사용 방지 (M3).
 */
export function useMarketCategoryChildren(
  marketId: MarketId | null,
  marketAccountId: string | null,
  parentId: string | null,
) {
  return useQuery<CategoryNode[]>({
    queryKey: ['registration', 'category-children', marketId, marketAccountId, parentId],
    queryFn: () => {
      if (!marketId || !marketAccountId) {
        throw new Error('marketId / marketAccountId required')
      }
      return fetchMarketCategoryChildren(marketId, marketAccountId, parentId)
    },
    enabled: marketId != null && marketAccountId != null,
    staleTime: 60 * 60 * 1000, // 1h
  })
}
