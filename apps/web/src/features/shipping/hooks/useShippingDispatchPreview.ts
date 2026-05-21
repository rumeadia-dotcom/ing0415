import { useQuery } from '@tanstack/react-query'
import { fetchShippingDispatchPreview, shippingQueryKeys } from '../api/shipping-api'
import type { ShippingDispatchPreview } from '../types/shipping-schema'

/**
 * n53 송장 일괄 제출 페이지 데이터 — status=waybill_printed 주문 + 마켓별 group.
 */
export function useShippingDispatchPreview() {
  return useQuery<ShippingDispatchPreview>({
    queryKey: shippingQueryKeys.dispatchPreview(),
    queryFn: fetchShippingDispatchPreview,
    staleTime: 15_000,
  })
}
