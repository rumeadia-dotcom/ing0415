import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { verifyMarket, marketQueryKeys } from '../api/markets-api'
import type { VerifyRequest, VerifyResponse } from '@/lib/schemas/markets-feature'

/**
 * 마켓 상태 확인 — markets-verify invoke.
 * 성공 시 last_verified_at / status 갱신 → realtime invalidate 또는 onSuccess 로 갱신.
 */
export function useVerifyMarket() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<VerifyResponse, unknown, VerifyRequest>({
    mutationFn: (req) => verifyMarket(req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketQueryKeys.accounts(sellerId) })
    },
  })
}
