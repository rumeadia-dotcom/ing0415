/**
 * Edge Function: markets-verify
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.6
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §2 (fetchCategoryTree 핑 용도)
 *
 * 책임:
 *   - 셀러가 "상태 확인" 클릭 또는 등록 시점 사전 검증.
 *   - access_token 로드 → adapter.fetchCategoryTree() 1회 호출 (인증 ping).
 *   - unauthorized → refreshToken 1회 시도, 성공 시 회복 / 실패 시 revoked.
 *   - rate_limit / server / network → status='error' + last_error_code.
 *
 * 강제:
 *   - ownership 검증 필수.
 *   - fetchCategoryTree 결과를 응답에 노출하지 않음 — 단순 ping. (캐시는 별도 함수 책임.)
 *   - 모든 분기 audit 적재.
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
import type { DecryptedCredential, MarketId } from '../_shared/index.ts'

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

    // 1) ownership + account 메타 조회
    const { data: account, error: accErr } = await supabase
      .from('market_accounts')
      .select(
        'id, seller_id, market_id, credential_id, account_label, status',
      )
      .eq('id', body.accountId)
      .maybeSingle()

    if (accErr) {
      throw HttpErrors.internal('internal', 'account lookup failed')
    }
    if (!account || account.seller_id !== sellerId) {
      throw HttpErrors.notFound('not_found', 'account not found')
    }
    if (account.status === 'revoked') {
      // 이미 해제된 계정은 verify 의미 없음 — 현재 상태 그대로 반환.
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

    // 2) adapter.fetchCategoryTree() ping (loadCredential 은 어댑터에 직접 토큰을 넘기지 않고
    //    어댑터가 내부적으로 토큰을 쓰는 stub 가정 — 현재 stub 은 throw 만 함. real 어댑터에
    //    토큰 주입 메커니즘은 OQ-10 확정 시 별도 결정. v1 mock 어댑터는 토큰 무관 동작 가능.)
    //    여기서는 loadCredential 호출로 토큰 만료 1차 검증, fetchCategoryTree 로 인증 2차 검증.
    let decrypted: DecryptedCredential
    try {
      decrypted = await loadCredential({
        credentialId,
        correlationId,
        logger,
      })
    } catch (_e) {
      // credential 로드 실패 = credential 상태가 active 아님 (loadCredential 이 forbidden throw).
      // account 도 동기화.
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
        },
        { correlationId },
      )
    }

    const adapter = getMarketAdapter(marketId)

    // 3) ping = fetchCategoryTree
    try {
      await adapter.fetchCategoryTree()
    } catch (e) {
      if (e instanceof MarketError && e.code === 'unauthorized') {
        // refresh 1회 시도
        try {
          const newTokens = await adapter.refreshToken(decrypted.refreshToken)
          await storeCredential({
            sellerId,
            marketId,
            marketAccountLabel: accountLabel,
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
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
          // refresh 도 실패 → revoked
          const reason =
            refreshErr instanceof MarketError ? refreshErr.code : 'unknown'
          await supabase
            .from('market_credentials')
            .update({
              status: 'revoked',
              last_refresh_error: reason,
              revoked_at: new Date().toISOString(),
            })
            .eq('id', credentialId)
          await supabase
            .from('market_accounts')
            .update({
              status: 'revoked',
              last_error_code: reason,
              last_error_at: new Date().toISOString(),
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
      }

      // 그 외 (rate_limit / server / network / validation / unknown)
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
        },
        { correlationId },
      )
    }

    // 4) 성공 — active 회복
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
      {
        sellerId,
        accountId: body.accountId,
        market: marketId,
        correlationId,
      },
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
  }),
)
