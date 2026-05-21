import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  verifyLogenCredential,
  shippingSettingsQueryKeys,
} from '../api/shipping-settings-api'
import type {
  LogenVerifyRequest,
  LogenVerifyResponse,
} from '@/lib/schemas/logen'

/**
 * 로젠 연결 테스트 mutation — `logen-verify-credential` Edge Function.
 *
 * v1 패턴: features/markets/hooks/useVerifyMarket.ts 와 동일 구조.
 * 성공 시 자격증명 상태 query invalidate.
 */
export function useLogenVerifyCredential() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<LogenVerifyResponse, unknown, LogenVerifyRequest>({
    mutationFn: (req) => verifyLogenCredential(req),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: shippingSettingsQueryKeys.credentialsStatus(sellerId),
      })
    },
  })
}
