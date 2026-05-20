/**
 * Edge Function: markets-oauth-callback
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.3
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §4.1, §8
 *
 * 책임:
 *   - 마켓이 콜백한 (code, state) 를 검증 (oauth_state row + httpOnly cookie 일치).
 *   - `getMarketAdapter('naver').authenticate({kind:'oauth_code', code})` → StoredCredential.
 *   - `storeCredential` → market_credentials UPSERT (credential_kind='oauth' + TokenSet payload).
 *   - `market_accounts` UPSERT (status='active').
 *   - market_account_audit / audit_log 적재.
 *   - Cookie 삭제.
 *
 * 강제 (Wave 2 갱신):
 *   - v1 OAuth 활성 마켓 = 네이버 단독. 쿠팡/G마켓/옥션/11번가는 본 함수가 처리하지 않는다.
 *     UI 가 잘못 호출 시 400 + 'market_not_oauth' 반환.
 *   - state 검증 + 소비 (consumed_at) 는 단일 트랜잭션. 동일 state 재사용 차단.
 *   - 평문 토큰은 응답 body 에 절대 미노출.
 *   - withRetry 는 rate_limit / server / network 만 재시도. unauthorized 는 즉시 실패.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  CORRELATION_HEADER,
  env,
  getMarketAdapter,
  getServiceClient,
  getUserClient,
  HttpErrors,
  MarketError,
  ok,
  parseBody,
  storeCredential,
  withRequest,
  withRetry,
} from '../_shared/index.ts'

const NON_OAUTH_MARKETS = new Set(['coupang', 'gmarket', 'auction'])

const RequestSchema = z.object({
  market: z.enum(['naver', 'coupang', 'gmarket', 'auction']),
  code: z.string().min(1).max(2000),
  state: z.string().min(32).max(128),
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

function extractStateCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === 'sb_oauth_state' && v) return v
  }
  return null
}

const clearStateCookie =
  'sb_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'

export default Deno.serve(
  withRequest(
    'markets-oauth-callback',
    async ({ req, logger, correlationId }) => {
      if (req.method !== 'POST') {
        throw HttpErrors.badRequest('method_not_allowed', 'POST required')
      }
      const body = await parseBody(req, RequestSchema)
      const sellerId = await resolveSellerId(req)

      // Wave 2: OAuth 활성 마켓 = 네이버 단독.
      if (NON_OAUTH_MARKETS.has(body.market)) {
        throw HttpErrors.badRequest(
          'market_not_oauth',
          '사용 가능한 OAuth 마켓은 네이버만 — 쿠팡/G마켓/옥션은 /markets-connect 사용',
        )
      }
      if (body.market !== 'naver') {
        throw HttpErrors.badRequest(
          'market_not_supported',
          `unsupported market for OAuth: ${body.market}`,
        )
      }
      const market = 'naver' as const

      // 1) Cookie ↔ body.state 일치
      const cookieState = extractStateCookie(req)
      if (!cookieState || cookieState !== body.state) {
        await appendAudit({
          category: 'markets',
          event: 'oauth_callback_failure',
          sellerId,
          meta: { market, reason: 'state_cookie_mismatch' },
          correlationId,
          logger,
        })
        throw HttpErrors.unauthorized('invalid_state', 'state cookie mismatch')
      }

      const supabase = getServiceClient()

      // 2) oauth_state 조회 + 검증 + 1회 소비
      const consumedAt = new Date().toISOString()
      const { data: stateRow, error: stateErr } = await supabase
        .from('oauth_state')
        .update({ consumed_at: consumedAt })
        .eq('state', body.state)
        .eq('seller_id', sellerId)
        .eq('market_id', market)
        .is('consumed_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('state, account_label, redirect_to')
        .maybeSingle()

      if (stateErr || !stateRow) {
        await appendAudit({
          category: 'markets',
          event: 'oauth_callback_failure',
          sellerId,
          meta: {
            market,
            reason: stateErr ? 'state_lookup_error' : 'state_invalid',
          },
          correlationId,
          logger,
        })
        throw HttpErrors.unauthorized(
          'invalid_state',
          'state not found / expired / already consumed',
        )
      }

      const accountLabel = (stateRow.account_label as string | null) ?? ''
      if (!accountLabel) {
        throw HttpErrors.internal(
          'state_missing_label',
          'oauth_state.account_label missing',
        )
      }
      const redirectTo = (stateRow.redirect_to as string | null) ?? '/markets'

      // 3) adapter.authenticate (withRetry). v1 변경: AuthInput discriminated union.
      const adapter = getMarketAdapter(market)
      let stored
      try {
        stored = await withRetry(
          () =>
            adapter.authenticate({ kind: 'oauth_code', code: body.code }),
          {
            market,
            correlationId,
            logger,
          },
        )
      } catch (e) {
        let httpCode: 'invalid_code' | 'market_unavailable' | 'rate_limited' =
          'market_unavailable'
        let reason = 'unknown'
        if (e instanceof MarketError) {
          reason = e.code
          if (e.code === 'unauthorized') httpCode = 'invalid_code'
          else if (e.code === 'rate_limit') httpCode = 'rate_limited'
          else if (e.code === 'server' || e.code === 'network') {
            httpCode = 'market_unavailable'
          } else if (e.code === 'validation') httpCode = 'invalid_code'
        }
        await appendAudit({
          category: 'markets',
          event: 'oauth_callback_failure',
          sellerId,
          meta: { market, reason },
          correlationId,
          logger,
        })
        await supabase.from('market_account_audit').insert({
          account_id: null,
          seller_id: sellerId,
          market_id: market,
          event: 'connect_failed',
          correlation_id: correlationId,
          error_code: reason,
        })
        if (httpCode === 'invalid_code') {
          throw HttpErrors.unauthorized(httpCode, 'market rejected the code')
        }
        if (httpCode === 'rate_limited') {
          throw HttpErrors.rateLimit()
        }
        throw HttpErrors.internal(httpCode, 'market currently unavailable')
      }

      // 안전 가드: OAuth 콜백은 'oauth' kind 만 받아들임.
      if (stored.kind !== 'oauth') {
        throw HttpErrors.internal(
          'credential_kind_mismatch',
          'naver authenticate returned non-oauth credential',
        )
      }
      const tokenSet = stored.payload // TokenSet

      // 4) storeCredential (credential_kind='oauth')
      let credentialId: string
      try {
        const res = await storeCredential({
          sellerId,
          marketId: market,
          accountLabel,
          credentialKind: 'oauth',
          payload: tokenSet as unknown as Record<string, unknown>,
          tokenExpiresAt: stored.expiresAt,
          scope: tokenSet.scope ? tokenSet.scope.split(/\s+/) : [],
          correlationId,
          logger,
        })
        credentialId = res.credentialId
      } catch {
        await appendAudit({
          category: 'markets',
          event: 'oauth_callback_failure',
          sellerId,
          meta: { market, reason: 'vault_unavailable' },
          correlationId,
          logger,
        })
        throw HttpErrors.internal(
          'vault_unavailable',
          'credential vault unavailable',
        )
      }

      // 5) market_accounts UPSERT
      const nowIso = new Date().toISOString()
      const { data: account, error: accErr } = await supabase
        .from('market_accounts')
        .upsert(
          {
            seller_id: sellerId,
            market_id: market,
            credential_id: credentialId,
            account_label: accountLabel,
            status: 'active',
            connected_at: nowIso,
            last_verified_at: nowIso,
            last_error_code: null,
            last_error_at: null,
            disconnected_at: null,
            updated_at: nowIso,
          },
          { onConflict: 'seller_id,market_id,account_label' },
        )
        .select('id, account_label, status, connected_at')
        .single()

      if (accErr || !account) {
        logger.error(
          {
            sellerId,
            market,
            rpcError: accErr?.code ?? 'unknown',
            correlationId,
          },
          '← market_accounts upsert error',
        )
        throw HttpErrors.internal('internal', 'failed to persist account')
      }

      // 6) audit
      await supabase.from('market_account_audit').insert({
        account_id: account.id,
        seller_id: sellerId,
        market_id: market,
        event: 'connect_succeeded',
        correlation_id: correlationId,
      })
      await appendAudit({
        category: 'markets',
        event: 'oauth_callback_success',
        sellerId,
        meta: { market, accountId: account.id, mode: env.APP_MODE },
        correlationId,
        logger,
      })

      logger.info(
        { sellerId, market, accountId: account.id, correlationId },
        '← oauth_callback ok',
      )

      const headers = new Headers()
      headers.set('Set-Cookie', clearStateCookie)
      headers.set(CORRELATION_HEADER, correlationId)
      return ok(
        {
          accountId: account.id as string,
          market,
          accountLabel: account.account_label as string,
          status: 'active' as const,
          connectedAt: account.connected_at as string,
          redirectTo,
          correlationId,
        },
        { correlationId, headers },
      )
    },
  ),
)
