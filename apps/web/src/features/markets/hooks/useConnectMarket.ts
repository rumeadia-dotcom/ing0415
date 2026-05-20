import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { connectMarket, marketQueryKeys } from '../api/markets-api'
import type { ConnectRequest, ConnectResponse } from '@/lib/schemas/markets-feature'

/**
 * 키 직접 입력 마켓 연결 (쿠팡 HMAC / G마켓·옥션 ESM JWT) — markets-connect invoke.
 */
export function useConnectMarket() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<ConnectResponse, unknown, ConnectRequest>({
    mutationFn: (req) => connectMarket(req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketQueryKeys.accounts(sellerId) })
    },
  })
}
