/**
 * 토큰 만료 시 1회 refresh 시도.
 *
 * - state.md §6.2 oauth_expired → 자동 1회 refresh → 실패 시 oauth_revoked.
 * - 본 모듈은 단순히 boolean 반환. 호출측이 unauthorized MarketError 로 분기.
 */

import {
  type getServiceClient,
  loadCredential,
  maskError,
  storeCredential,
  type Logger,
  type MarketAdapter,
  type MarketId,
} from '../../_shared/index.ts'
import { loadAccountLabel } from './data-load.ts'

type Service = ReturnType<typeof getServiceClient>

export async function tryRefreshCredential(args: {
  service: Service
  adapter: MarketAdapter
  credentialId: string
  sellerId: string
  marketId: MarketId
  marketAccountId: string
  correlationId: string
  logger: Logger
}): Promise<boolean> {
  try {
    // adapter.refreshToken 은 optional (OAuth = 네이버 한정). 미구현 마켓은 refresh 불가.
    const adapterRefresh = args.adapter.refreshToken
    if (typeof adapterRefresh !== 'function') {
      args.logger.warn(
        { market: args.marketId, marketAccountId: args.marketAccountId },
        '↻ adapter has no refreshToken — skip',
      )
      return false
    }
    const cred = await loadCredential({
      credentialId: args.credentialId,
      correlationId: args.correlationId,
      logger: args.logger,
    })
    // refresh token 은 payload jsonb(oauth TokenSet 모양) 안에 — DecryptedCredential 최상위 아님.
    const oauthPayload = cred.payload as { refreshToken?: string }
    const refreshTok = oauthPayload.refreshToken
    if (typeof refreshTok !== 'string' || refreshTok.length === 0) {
      args.logger.warn(
        { market: args.marketId, marketAccountId: args.marketAccountId },
        '↻ no refresh token in payload — skip',
      )
      return false
    }
    const newSet = await adapterRefresh(refreshTok)
    const label = await loadAccountLabel(args.service, args.marketAccountId)
    // markets-token-refresh §3 과 동일 — oauth kind, payload=TokenSet, scope 공백 분리.
    await storeCredential({
      sellerId: args.sellerId,
      marketId: args.marketId,
      accountLabel: label,
      credentialKind: 'oauth',
      payload: newSet as unknown as Record<string, unknown>,
      tokenExpiresAt: newSet.expiresAt,
      scope: newSet.scope ? newSet.scope.split(/\s+/) : [],
      correlationId: args.correlationId,
      logger: args.logger,
    })
    return true
  } catch (e) {
    args.logger.warn(
      { market: args.marketId, marketAccountId: args.marketAccountId, err: maskError(e) },
      '↻ token refresh failed',
    )
    return false
  }
}
