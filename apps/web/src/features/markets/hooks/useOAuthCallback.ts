import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { oauthCallback, marketQueryKeys } from '../api/markets-api'
import type { OAuthCallbackRequest, OAuthCallbackResponse } from '@/lib/schemas/markets-feature'

/**
 * OAuth 콜백 처리 — markets-oauth-callback invoke.
 * onSuccess 시 market_accounts query 무효화 → 목록 즉시 갱신.
 */
export function useOAuthCallback() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const sellerId = user?.id ?? null

  return useMutation<OAuthCallbackResponse, unknown, OAuthCallbackRequest>({
    mutationFn: (req) => oauthCallback(req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketQueryKeys.accounts(sellerId) })
    },
  })
}
