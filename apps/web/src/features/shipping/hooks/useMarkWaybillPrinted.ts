import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  markWaybillPrinted,
  shippingQueryKeys,
  type ShippingApiError,
} from '../api/shipping-api'
import type {
  MarkWaybillPrintedRequest,
  MarkWaybillPrintedResponse,
} from '../types/shipping-schema'

/**
 * n52 [출력 완료] — orders.shipping_status='waybill_printed' 로 전환.
 * 성공 시 print-list / dispatch-preview 둘 다 invalidate.
 */
export function useMarkWaybillPrinted() {
  const qc = useQueryClient()
  return useMutation<MarkWaybillPrintedResponse, ShippingApiError, MarkWaybillPrintedRequest>({
    mutationFn: markWaybillPrinted,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shippingQueryKeys.printList() })
      void qc.invalidateQueries({ queryKey: shippingQueryKeys.dispatchPreview() })
    },
  })
}
