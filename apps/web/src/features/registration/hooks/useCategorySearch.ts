import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCategorySearch } from '../api/category-api'
import type { CategorySearchResponse, MarketId } from '@/lib/schemas'

/** 입력 디바운스 (default 250ms). */
function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * 카테고리명 부분일치 검색 (전역 인덱스). 마스터: category-sync.md §6.
 *
 * - 250ms 디바운스, enabled = q≥2 & marketId!=='naver' & marketAccountId 존재.
 * - status==='building'(ESM 인덱스 빌드 중) 이면 4s 폴링 → ready 전환 시 자동 hits.
 * - Query Key: ['registration','category-search', marketId, debouncedQuery]
 */
export function useCategorySearch(
  marketId: MarketId | null,
  marketAccountId: string | null,
  query: string,
) {
  const debounced = useDebounced(query.trim(), 250)
  const enabled =
    marketId != null &&
    marketId !== 'naver' &&
    marketAccountId != null &&
    debounced.length >= 2

  return useQuery<CategorySearchResponse>({
    queryKey: ['registration', 'category-search', marketId, debounced],
    enabled,
    staleTime: 60_000,
    queryFn: () => {
      if (!marketId || !marketAccountId) {
        throw new Error('marketId / marketAccountId required')
      }
      return fetchCategorySearch(marketId, marketAccountId, debounced)
    },
    // building 동안만 폴링(TanStack v5 — 콜백은 Query 객체 수신).
    refetchInterval: (q) =>
      q.state.data?.status === 'building' ? 4000 : false,
  })
}
