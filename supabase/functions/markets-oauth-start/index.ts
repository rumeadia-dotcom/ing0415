/**
 * Edge Function: markets-oauth-start
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.2
 *   - docs/architecture/v1/cross-cutting/credential-vault.md §1.1, §8 (state)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §8 (OAuth 시퀀스)
 *
 * 책임:
 *   - 셀러 본인 인증 (JWT) → seller_id 추출.
 *   - state 32 bytes 난수 + (마켓이 PKCE 지원 시) PKCE verifier 발급.
 *   - oauth_state INSERT (consume 1회 / expires 10분).
 *   - 마켓 authorize URL 을 어댑터 stub 의 endpoint 메타 + env client_id 로 빌드.
 *   - market_account_audit (`connect_initiated`) + audit_log (`markets/oauth_start`).
 *
 * 강제:
 *   - v1 활성 마켓 = 'naver' 1개 (2026-05-19 결정 — OQ-10). 'coupang' 은 zod enum 유지로 인터페이스
 *     호환 보존하되 `getMarketAdapter` 단계에서 즉시 throw 되므로 운영 경로 차단.
 *   - 그 외 마켓은 `market_not_supported`.
 *   - redirectTo 는 '/' 로 시작 + 절대 URL 거부.
 *   - state 는 응답 body 에 노출 금지 (markets.md §5.2 "금지"). httpOnly Cookie 만.
 *   - 네이버 토큰 endpoint = https://api.commerce.naver.com/external/v1/oauth2/token (확정).
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  CORRELATION_HEADER,
  env,
  getServiceClient,
  getUserClient,
  HttpErrors,
  isDebug,
  ok,
  parseBody,
  withRequest,
} from '../_shared/index.ts'

const SUPPORTED_MARKETS = ['naver', 'coupang'] as const
type SupportedMarket = (typeof SUPPORTED_MARKETS)[number]

const RequestSchema = z.object({
  market: z.enum(SUPPORTED_MARKETS),
  accountLabel: z.string().min(1).max(40),
  redirectTo: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => s.startsWith('/') && !s.startsWith('//'), {
      message: 'redirectTo must be a same-origin path starting with /',
    }),
})

const STATE_BYTES = 32
const STATE_EXPIRES_SEC = 600 // 10분

/** state = base64url(32 bytes). */
function generateState(): string {
  const buf = new Uint8Array(STATE_BYTES)
  crypto.getRandomValues(buf)
  // base64url
  const b64 = btoa(String.fromCharCode(...buf))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 마켓별 OAuth authorize URL 빌드. Phase 2 에서 어댑터로 이관 (OQ-10).
 * 현재는 markets.md §3.1 잠정 endpoint 사용.
 *
 * debug 모드는 mock URL 반환 (외부 마켓 호출 0).
 */
function buildAuthorizeUrl(
  market: SupportedMarket,
  state: string,
  redirectUri: string,
): string {
  if (isDebug) {
    const url = new URL(`${env.PUBLIC_APP_ORIGIN}/markets/mock-authorize`)
    url.searchParams.set('market', market)
    url.searchParams.set('state', state)
    url.searchParams.set('redirect_uri', redirectUri)
    return url.toString()
  }
  // real: markets.md §3.1 잠정값. OQ-10 확정 시 어댑터로 이관.
  if (market === 'naver') {
    const clientId = env.NAVER_CLIENT_ID
    if (!clientId) {
      throw HttpErrors.internal(
        'oauth_config_missing',
        'NAVER_CLIENT_ID not configured',
      )
    }
    const url = new URL(
      'https://api.commerce.naver.com/external/v1/oauth2/authorize',
    )
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('scope', 'product.write product.read')
    return url.toString()
  }
  // coupang
  const clientId = env.COUPANG_VENDOR_ID
  if (!clientId) {
    throw HttpErrors.internal(
      'oauth_config_missing',
      'COUPANG_VENDOR_ID not configured',
    )
  }
  const url = new URL('https://api-gateway.coupang.com/oauth2/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', 'seller.product.write seller.product.read')
  return url.toString()
}

function callbackRedirectUri(market: SupportedMarket): string {
  return `${env.PUBLIC_APP_ORIGIN}/markets/callback/${market}`
}

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

export default Deno.serve(
  withRequest('markets-oauth-start', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }
    const body = await parseBody(req, RequestSchema)
    const sellerId = await resolveSellerId(req)
    const market = body.market

    const supabase = getServiceClient()

    // duplicate_label 검사 — active / expired 상태가 이미 있으면 거부 (revoked / error 는 재연결 허용).
    const { data: existing, error: dupErr } = await supabase
      .from('market_accounts')
      .select('id, status')
      .eq('seller_id', sellerId)
      .eq('market_id', market)
      .eq('account_label', body.accountLabel)
      .in('status', ['active', 'expired'])
      .maybeSingle()
    if (dupErr) {
      logger.error(
        {
          sellerId,
          market,
          rpcError: dupErr.code ?? 'unknown',
          correlationId,
        },
        '← market_accounts dup lookup error',
      )
      throw HttpErrors.internal('internal', 'duplicate check failed')
    }
    if (existing) {
      // audit (connect_failed) — 일관성 위해 시도 기록 남김.
      await appendAudit({
        category: 'markets',
        event: 'connect_initiated_rejected',
        sellerId,
        meta: { market, reason: 'duplicate_label' },
        correlationId,
        logger,
      })
      throw HttpErrors.conflict(
        'duplicate_label',
        'account label already exists for this market',
      )
    }

    const state = generateState()
    const redirectUri = callbackRedirectUri(market)
    const expiresAt = new Date(Date.now() + STATE_EXPIRES_SEC * 1000).toISOString()

    // oauth_state INSERT — service_role only 테이블.
    // markets.md §5.3 의 §8 가정대로 oauth_state 에 account_label 컬럼 존재 가정.
    const { error: insErr } = await supabase.from('oauth_state').insert({
      state,
      seller_id: sellerId,
      market_id: market,
      redirect_to: body.redirectTo,
      account_label: body.accountLabel,
      pkce_verifier: null, // PKCE v1 미사용 (markets.md §3.2)
      expires_at: expiresAt,
    })
    if (insErr) {
      logger.error(
        {
          sellerId,
          market,
          rpcError: insErr.code ?? 'unknown',
          correlationId,
        },
        '← oauth_state insert error',
      )
      throw HttpErrors.internal('internal', 'failed to persist oauth state')
    }

    let authorizeUrl: string
    try {
      authorizeUrl = buildAuthorizeUrl(market, state, redirectUri)
    } catch (e) {
      // env 누락 등. oauth_state 는 이미 INSERT — 만료로 자동 정리.
      throw e
    }

    // market_account_audit (connect_initiated)
    const { error: accAuditErr } = await supabase
      .from('market_account_audit')
      .insert({
        account_id: null,
        seller_id: sellerId,
        market_id: market,
        event: 'connect_initiated',
        correlation_id: correlationId,
      })
    if (accAuditErr) {
      logger.warn(
        {
          sellerId,
          market,
          rpcError: accAuditErr.code ?? 'unknown',
          correlationId,
        },
        '← market_account_audit insert warn (non-blocking)',
      )
    }

    // audit_log
    await appendAudit({
      category: 'markets',
      event: 'oauth_start',
      sellerId,
      meta: { market, mode: env.APP_MODE },
      correlationId,
      logger,
    })

    logger.info(
      {
        sellerId,
        market,
        correlationId,
        stateLen: state.length,
      },
      '← oauth_start ok',
    )

    // state cookie: httpOnly / Secure / SameSite=Lax / Max-Age=600 / Path=/
    const headers = new Headers()
    headers.set(
      'Set-Cookie',
      `sb_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STATE_EXPIRES_SEC}`,
    )
    headers.set(CORRELATION_HEADER, correlationId)

    // 응답 body 에 state 노출 금지 (markets.md §5.2 금지). cookie 만.
    return ok(
      {
        authorizeUrl,
        correlationId,
      },
      { correlationId, headers },
    )
  }),
)
