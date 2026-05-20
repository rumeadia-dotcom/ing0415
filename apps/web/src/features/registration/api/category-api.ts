import { getMarketAdapter } from '@/lib/markets'
import type { CategoryNode, MarketId } from '@/lib/schemas'

/**
 * 마켓별 카테고리 트리 조회.
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §2.1 fetchCategoryTree
 *
 * - debug 모드: NaverDebugAdapter 등 mock 어댑터가 정적 트리 반환.
 * - real 모드: Edge Function `markets-categories-sync` 경유 (Phase 3 도입 시 어댑터 내부에서 처리).
 *
 * 클라이언트 캐싱은 useMarketCategoryTree hook 의 useQuery staleTime 으로.
 */
export async function fetchMarketCategoryTree(marketId: MarketId): Promise<CategoryNode[]> {
  const adapter = await getMarketAdapter(marketId)
  return adapter.fetchCategoryTree()
}
