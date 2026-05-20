import { useMutation } from '@tanstack/react-query'
import { oauthStart } from '../api/markets-api'
import type { OAuthStartRequest, OAuthStartResponse } from '@/lib/schemas/markets-feature'

/**
 * OAuth 인증 시작 — markets-oauth-start invoke.
 * onSuccess 시 호출측이 window.location.assign(authorizeUrl) 책임.
 */
export function useOAuthStart() {
  return useMutation<OAuthStartResponse, unknown, OAuthStartRequest>({
    mutationFn: (req) => oauthStart(req),
  })
}
