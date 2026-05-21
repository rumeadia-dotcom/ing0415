import { useQuery } from '@tanstack/react-query'
import { fetchShippingPrintList, shippingQueryKeys } from '../api/shipping-api'
import type { ShippingPrintOrder } from '../types/shipping-schema'

/**
 * n52 운송장 출력 페이지 데이터 — status=logen_registered 주문 목록.
 * 폴링 없음 (사용자 행동 후 invalidate). staleTime 15초.
 */
export function useShippingPrintList() {
  return useQuery<ShippingPrintOrder[]>({
    queryKey: shippingQueryKeys.printList(),
    queryFn: fetchShippingPrintList,
    staleTime: 15_000,
  })
}
