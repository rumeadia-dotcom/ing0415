import { useQuery } from '@tanstack/react-query'
import { fetchShippingJobs, shippingQueryKeys } from '../api/shipping-api'
import type { ShippingJobListItem } from '../types/shipping-schema'

/**
 * n57 배송 이력 목록 — 최근 100건.
 * 정식 페이지네이션은 후속 (registration/history 와 동일 패턴 적용 시점에 합의).
 */
export function useShippingJobs() {
  return useQuery<ShippingJobListItem[]>({
    queryKey: shippingQueryKeys.jobs(),
    queryFn: fetchShippingJobs,
    staleTime: 15_000,
  })
}
