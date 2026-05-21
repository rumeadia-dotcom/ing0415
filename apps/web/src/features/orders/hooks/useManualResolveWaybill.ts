import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  manualResolveWaybill,
  ordersQueryKeys,
  type ManualResolveResult,
} from '../api/orders-api'
import type { ManualResolveWaybillInput } from '@/lib/schemas/orders'

/**
 * 운송장 수동 입력 mutation (n50).
 * 성공 시 해당 주문 상세 + 목록 + 요약 모두 invalidate.
 *
 * 마스터: docs/architecture/v1/features/orders.md §3.4 (PR2 신설).
 */
export function useManualResolveWaybill() {
  const qc = useQueryClient()
  return useMutation<ManualResolveResult, Error, ManualResolveWaybillInput>({
    mutationFn: (input) =>
      manualResolveWaybill({
        orderId: input.orderId,
        waybillNumber: input.waybillNumber,
        note: input.note,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ordersQueryKeys.detail(res.orderId) })
      void qc.invalidateQueries({ queryKey: ordersQueryKeys.all })
    },
  })
}
