import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  retryShippingDispatch,
  shippingQueryKeys,
  type ShippingApiError,
} from '../api/shipping-api'
import type {
  ShippingDispatchRetryRequest,
  ShippingDispatchRetryResponse,
} from '../types/shipping-schema'

/**
 * n56 부분 재시도 — failed/failed_final 마켓 result 만 골라 재시도.
 */
export function useShippingJobRetry() {
  const qc = useQueryClient()
  return useMutation<ShippingDispatchRetryResponse, ShippingApiError, ShippingDispatchRetryRequest>({
    mutationFn: retryShippingDispatch,
    onSuccess: (resp) => {
      void qc.invalidateQueries({ queryKey: shippingQueryKeys.job(resp.jobId) })
      void qc.invalidateQueries({ queryKey: shippingQueryKeys.jobs() })
    },
  })
}
