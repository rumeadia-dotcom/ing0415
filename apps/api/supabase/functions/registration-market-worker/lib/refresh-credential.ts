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
    const cred = await loadCredential({
      credentialId: args.credentialId,
      correlationId: args.correlationId,
      logger: args.logger,
    })
    const newSet = await args.adapter.refreshToken(cred.refreshToken)
    const label = await loadAccountLabel(args.service, args.marketAccountId)
    await storeCredential({
      sellerId: args.sellerId,
      marketId: args.marketId,
      marketAccountLabel: label,
      accessToken: newSet.accessToken,
      refreshToken: newSet.refreshToken,
      tokenExpiresAt: newSet.expiresAt,
      scope: newSet.scope ? [newSet.scope] : [],
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
