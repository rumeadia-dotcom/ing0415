import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  startShippingDispatch,
  shippingQueryKeys,
  type ShippingApiError,
} from '../api/shipping-api'
import type {
  ShippingDispatchStartRequest,
  ShippingDispatchStartResponse,
} from '../types/shipping-schema'

/**
 * n53 [제출 시작] 버튼 → shipping-dispatch-job Edge Function invoke.
 * 성공 시 미리보기·이력 query invalidate. 호출 컴포넌트가 onSuccess 에서 결과 페이지로 이동.
 */
export function useShippingDispatchStart() {
  const qc = useQueryClient()
  return useMutation<ShippingDispatchStartResponse, ShippingApiError, ShippingDispatchStartRequest>({
    mutationFn: startShippingDispatch,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shippingQueryKeys.dispatchPreview() })
      void qc.invalidateQueries({ queryKey: shippingQueryKeys.jobs() })
    },
  })
}
