import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import {
  setLogenCredentials,
  shippingSettingsQueryKeys,
} from '../api/shipping-settings-api'
import type {
  LogenCredentialsInput,
  LogenSenderInfo,
} from '@/lib/schemas/logen'

/**
 * 발송인 정보 저장 mutation — `set_logen_credentials` RPC.
 *
 * 발송인 정보만 단독 갱신하며, credentials 갱신은 useLogenCredentialsUpsert 가 담당.
 */
export function useLogenSenderInfoUpdate() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<unknown, unknown, LogenSenderInfo>({
    mutationFn: (senderInfo) => setLogenCredentials({ senderInfo }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: shippingSettingsQueryKeys.credentialsStatus(sellerId),
      })
    },
  })
}

/**
 * 자격증명 (userId / custCd) 저장 mutation — `set_logen_credentials` RPC.
 * Edge runtime 에서 pgcrypto 로 즉시 암호화 저장.
 */
export function useLogenCredentialsUpsert() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<unknown, unknown, LogenCredentialsInput>({
    mutationFn: (credentials) => setLogenCredentials({ credentials }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: shippingSettingsQueryKeys.credentialsStatus(sellerId),
      })
    },
  })
}
