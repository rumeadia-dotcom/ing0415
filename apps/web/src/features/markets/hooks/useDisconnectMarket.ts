import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { disconnectMarket, marketQueryKeys } from '../api/markets-api'
import type { DisconnectRequest, DisconnectResponse } from '@/lib/schemas/markets-feature'

/**
 * 마켓 연결 해제 — markets-disconnect invoke.
 */
export function useDisconnectMarket() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<DisconnectResponse, unknown, DisconnectRequest>({
    mutationFn: (req) => disconnectMarket(req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketQueryKeys.accounts(sellerId) })
    },
  })
}
