/**
 * Edge Function: markets-verify
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.6
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §2 (fetchCategoryTree 핑)
 *
 * 책임:
 *   - 셀러가 "상태 확인" 클릭 또는 등록 시점 사전 검증.
 *   - credential 로드 → adapter.fetchCategoryTree() 1회 호출 (인증 ping).
 *   - oauth kind 의 경우 unauthorized → refreshToken 1회 시도, 성공 시 회복 / 실패 시 revoked.
 *   - hmac/esm_jwt 의 경우 unauthorized 즉시 revoked (영구 키 — refresh 경로 없음).
 *   - rate_limit / server / network → status='error' + last_error_code.
 *
 * 강제 (Wave 2 갱신):
 *   - 5개 마켓 모두 처리. 11번가는 getMarketAdapter 가 즉시 throw → catch 후 error 상태.
 *   - ownership 검증 필수. 결과 응답에 fetchCategoryTree 데이터 노출 금지 (단순 ping).
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getMarketAdapter,
  getServiceClient,
  getUserClient,
  HttpErrors,
  loadCredential,
  MarketError,
  ok,
  parseBody,
  storeCredential,
  withRequest,
} from '../_shared/index.ts'
import type {
  DecryptedCredential,
  MarketId,
  StoredCredential,
} from '../_shared/index.ts'

const RequestSchema = z.object({
  accountId: z.string().uuid(),
})

async function resolveSellerId(req: Request): Promise<string> {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token.length < 10) {
    throw HttpErrors.unauthorized('invalid_token', 'token format invalid')
  }
  const supabase = getUserClient(token)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
  }
  return data.user.id
}

type AccountStatus = 'active' | 'expired' | 'revoked' | 'error'

export default Deno.serve(
  withRequest('markets-verify', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }
    const body = await parseBody(req, RequestSchema)
    const sellerId = await resolveSellerId(req)

    const supabase = getServiceClient()

    const { data: account, error: accErr } = await supabase
      .from('market_accounts')
      .select(
        'id, seller_id, market_id, credential_id, account_label, status',
      )
      .eq('id', body.accountId)
      .maybeSingle()

    if (accErr) {
      throw HttpErrors.internal('internal', 'account lookup failed', {
        stage: 'account_lookup',
      })
    }
    if (!account || account.seller_id !== sellerId) {
      throw HttpErrors.notFound('not_found', 'account not found')
    }
    if (account.status === 'revoked') {
      return ok(
        {
          accountId: body.accountId,
          status: 'revoked' as AccountStatus,
          lastVerifiedAt: new Date().toISOString(),
          correlationId,
        },
        { correlationId },
      )
    }

    const marketId = account.market_id as MarketId
    const credentialId = account.credential_id as string
    const accountLabel = account.account_label as string

    let decrypted: DecryptedCredential
    try {
      decrypted = await loadCredential({
        credentialId,
        correlationId,
        logger,
      })
    } catch (_e) {
      await supabase
        .from('market_accounts')
        .update({
          status: 'expired',
          last_error_code: 'credential_inactive',
          last_error_at: new Date().toISOString(),
        })
        .eq('id', body.accountId)
      await supabase.from('market_account_audit').insert({
        account_id: body.accountId,
        seller_id: sellerId,
        market_id: marketId,
        event: 'verify_failed',
        correlation_id: correlationId,
        error_code: 'credential_inactive',
      })
      await appendAudit({
        category: 'markets',
        event: 'verify_failure',
        sellerId,
        meta: { market: marketId, reason: 'credential_inactive' },
        correlationId,
        logger,
      })
      return ok(
        {
          accountId: body.accountId,
          status: 'expired' as AccountStatus,
          lastVerifiedAt: new Date().toISOString(),
          correlationId,
          errorCode: 'credential_inactive',
          errorMessage: '자격증명이 만료되었습니다. 재연결해 주세요.',
          errorMarket: marketId,
        },
        { correlationId },
      )
    }

    let adapter
    try {
      adapter = getMarketAdapter(marketId)
    } catch (e) {
      // 11번가 등 v1 미사용 — error 상태로 기록.
      const nowIso = new Date().toISOString()
      const reason = (e instanceof Error ? e.message : 'adapter_unavailable')
        .slice(0, 120)
      await supabase
        .from('market_accounts')
        .update({
          status: 'error',
          last_error_code: 'adapter_unavailable',
          last_error_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', body.accountId)
      await appendAudit({
        category: 'markets',
        event: 'verify_failure',
        sellerId,
        meta: { market: marketId, reason },
        correlationId,
        logger,
      })
      return ok(
        {
          accountId: body.accountId,
          status: 'error' as AccountStatus,
          lastVerifiedAt: nowIso,
          correlationId,
          errorCode: 'adapter_unavailable',
          errorMessage: reason,
          errorMarket: marketId,
        },
        { correlationId },
      )
    }

    try {
      // 저장 자격증명으로 어댑터 hydrate (authenticate 미경유 경로 — 필수).
      // 누락 시 fetchCategoryTree 가 'authenticate 먼저' unauthorized 를 던져
      // 멀쩡한 연결이 revoked 처리됨 (2026-05-27 사고).
      adapter.hydrate({
        kind: decrypted.credentialKind,
        payload: decrypted.payload,
      } as StoredCredential)
      await adapter.fetchCategoryTree()
    } catch (e) {
      if (e instanceof MarketError && e.code === 'unauthorized') {
        // oauth 만 refresh 1회 시도. hmac/esm_jwt 는 즉시 revoked.
        if (
          decrypted.credentialKind === 'oauth' &&
          typeof adapter.refreshToken === 'function'
        ) {
          const oauthPayload = decrypted.payload as { refreshToken?: string }
          const refreshTok = oauthPayload.refreshToken
          if (typeof refreshTok === 'string' && refreshTok.length > 0) {
            try {
              const newTokens = await adapter.refreshToken(refreshTok)
              await storeCredential({
                sellerId,
                marketId,
                accountLabel,
                credentialKind: 'oauth',
                payload: newTokens as unknown as Record<string, unknown>,
                tokenExpiresAt: newTokens.expiresAt,
                scope: newTokens.scope ? newTokens.scope.split(/\s+/) : [],
                correlationId,
                logger,
              })
              const nowIso = new Date().toISOString()
              await supabase
                .from('market_accounts')
                .update({
                  status: 'active',
                  last_verified_at: nowIso,
                  last_error_code: null,
                  last_error_at: null,
                  updated_at: nowIso,
                })
                .eq('id', body.accountId)
              await supabase.from('market_account_audit').insert({
                account_id: body.accountId,
                seller_id: sellerId,
                market_id: marketId,
                event: 'verify_succeeded',
                correlation_id: correlationId,
              })
              await appendAudit({
                category: 'markets',
                event: 'verify_success',
                sellerId,
                meta: { market: marketId, recovered: true },
                correlationId,
                logger,
              })
              return ok(
                {
                  accountId: body.accountId,
                  status: 'active' as AccountStatus,
                  lastVerifiedAt: nowIso,
                  correlationId,
                },
                { correlationId },
              )
            } catch (refreshErr) {
              const reason =
                refreshErr instanceof MarketError ? refreshErr.code : 'unknown'
              await markRevoked(reason)
              return ok(
                {
                  accountId: body.accountId,
                  status: 'revoked' as AccountStatus,
                  lastVerifiedAt: new Date().toISOString(),
                  correlationId,
                  errorCode: reason,
                  errorMessage:
                    refreshErr instanceof Error ? refreshErr.message : 'token refresh failed',
                  errorMarket: marketId,
                },
                { correlationId },
              )
            }
          }
        }
        // 영구 키 (hmac/esm_jwt) 또는 oauth 인데 refresh 토큰 없음 → 즉시 revoked.
        await markRevoked(e.code)
        return ok(
          {
            accountId: body.accountId,
            status: 'revoked' as AccountStatus,
            lastVerifiedAt: new Date().toISOString(),
            correlationId,
            errorCode: e.code,
            errorMessage: e.message,
            errorMarket: marketId,
          },
          { correlationId },
        )
      }

      const reason = e instanceof MarketError ? e.code : 'unknown'
      const nowIso = new Date().toISOString()
      await supabase
        .from('market_accounts')
        .update({
          status: 'error',
          last_error_code: reason,
          last_error_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', body.accountId)
      await supabase.from('market_account_audit').insert({
        account_id: body.accountId,
        seller_id: sellerId,
        market_id: marketId,
        event: 'verify_failed',
        correlation_id: correlationId,
        error_code: reason,
      })
      await appendAudit({
        category: 'markets',
        event: 'verify_failure',
        sellerId,
        meta: { market: marketId, reason },
        correlationId,
        logger,
      })
      return ok(
        {
          accountId: body.accountId,
          status: 'error' as AccountStatus,
          lastVerifiedAt: nowIso,
          correlationId,
          errorCode: reason,
          errorMessage: e instanceof MarketError ? e.message : 'verify failed',
          errorMarket: marketId,
        },
        { correlationId },
      )
    }

    // 성공
    const nowIso = new Date().toISOString()
    await supabase
      .from('market_accounts')
      .update({
        status: 'active',
        last_verified_at: nowIso,
        last_error_code: null,
        last_error_at: null,
        updated_at: nowIso,
      })
      .eq('id', body.accountId)
    await supabase.from('market_account_audit').insert({
      account_id: body.accountId,
      seller_id: sellerId,
      market_id: marketId,
      event: 'verify_succeeded',
      correlation_id: correlationId,
    })
    await appendAudit({
      category: 'markets',
      event: 'verify_success',
      sellerId,
      meta: { market: marketId },
      correlationId,
      logger,
    })

    logger.info(
      { sellerId, accountId: body.accountId, market: marketId, correlationId },
      '← verify ok',
    )

    return ok(
      {
        accountId: body.accountId,
        status: 'active' as AccountStatus,
        lastVerifiedAt: nowIso,
        correlationId,
      },
      { correlationId },
    )

    // ─────────────────────────────────────────────
    async function markRevoked(reason: string): Promise<void> {
      const nowIso2 = new Date().toISOString()
      await supabase
        .from('market_credentials')
        .update({
          status: 'revoked',
          last_refresh_error: reason,
          revoked_at: nowIso2,
        })
        .eq('id', credentialId)
      await supabase
        .from('market_accounts')
        .update({
          status: 'revoked',
          last_error_code: reason,
          last_error_at: nowIso2,
        })
        .eq('id', body.accountId)
      await supabase.from('market_account_audit').insert({
        account_id: body.accountId,
        seller_id: sellerId,
        market_id: marketId,
        event: 'auto_revoked',
        correlation_id: correlationId,
        error_code: reason,
      })
      await appendAudit({
        category: 'markets',
        event: 'verify_failure',
        sellerId,
        meta: { market: marketId, reason, recoveredViaRefresh: false },
        correlationId,
        logger,
      })
    }
  }),
)
