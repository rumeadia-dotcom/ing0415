/**
 * 네이버 스마트스토어 OAuth token exchange — Edge Function 분리 모듈.
 *
 * 마스터:
 *   - docs/architecture/v1/features/markets.md §5.3
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.1
 *   - WIP-5markets-mvp.md C-1 Phase 2
 *
 * 책임:
 *   - Authorization Code → access/refresh token 교환 (POST /external/v1/oauth2/token).
 *   - client_id / client_secret 은 Edge Function env (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)
 *     에서만 읽음. FE 노출 금지.
 *   - PKCE codeVerifier 매칭 (oauth_state.pkce_verifier 와 일치 검증).
 *   - TokenSet zod 검증 → markets-oauth-callback/index.ts 가 storeCredential 로 적재.
 *
 * 강제:
 *   - access/refresh 토큰은 응답 본문 / 로그 / Sentry 에 절대 평문 노출 금지.
 *   - 본 모듈은 순수 함수에 가깝게 작성 (`exchangeNaverAuthCode` 가 main).
 *     RPC / DB / audit 부수효과는 호출측(`index.ts`) 책임.
 *   - 단위 테스트가 import 가능하도록 Deno-only API (Deno.env, npm: prefix) 는
 *     함수 시그니처가 아닌 본문 내부에서만 접근.
 */

import { z } from 'npm:zod@3.23.8'
import { MarketError } from '../_shared/errors.ts'
import type { Logger } from '../_shared/logger.ts'
import { TokenSetSchema, type TokenSet } from '../_shared/schemas.ts'

export const NAVER_API_BASE = 'https://api.commerce.naver.com'
export const NAVER_TOKEN_PATH = '/external/v1/oauth2/token'
const MARKET = 'naver' as const
const TOKEN_TIMEOUT_MS = 15_000

// ─────────────────────────────────────────────
// 네이버 OAuth 토큰 응답 스키마 (RFC 6749 표준)
// ─────────────────────────────────────────────

export const NaverTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().default('Bearer'),
  scope: z.string().optional(),
})
export type NaverTokenResponse = z.infer<typeof NaverTokenResponseSchema>

// ─────────────────────────────────────────────
// Naver 응답 → TokenSet 변환 (순수)
// ─────────────────────────────────────────────

/**
 * Naver token 응답 → TokenSet (expiresAt = now + expires_in*1000).
 * `now` 는 결정성을 위해 호출자가 주입 가능.
 *
 * 응답 검증 실패 시 MarketError('server') throw.
 */
export function naverTokenResponseToTokenSet(
  raw: unknown,
  opts: { now?: Date } = {},
): TokenSet {
  const parsed = NaverTokenResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new MarketError('server', '네이버 토큰 응답 스키마 불일치', {
      market: MARKET,
      cause: parsed.error,
    })
  }
  const now = opts.now ?? new Date()
  const expiresAtMs = now.getTime() + parsed.data.expires_in * 1000
  // TokenSet 스키마는 `+offset` 포맷 요구 (datetime({ offset: true })).
  const expiresAt = new Date(expiresAtMs).toISOString().replace(/Z$/, '+00:00')

  return TokenSetSchema.parse({
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresAt,
    tokenType: 'Bearer',
    ...(parsed.data.scope !== undefined ? { scope: parsed.data.scope } : {}),
  })
}

// ─────────────────────────────────────────────
// PKCE codeVerifier 매칭
// ─────────────────────────────────────────────

/**
 * oauth_state.pkce_verifier 가 저장되어 있는 경우, 요청과 일치하는지 확인.
 *  - 둘 다 null/undefined → ok (PKCE 미사용 케이스).
 *  - 한쪽만 존재 → MarketError('validation').
 *  - 양쪽 존재 + 다름 → MarketError('validation').
 *
 * 본 검증은 markets-oauth-callback/index.ts 가 호출 책임.
 */
export function verifyPkceVerifier(
  stateVerifier: string | null | undefined,
  requestVerifier: string | null | undefined,
): void {
  const has = (s: string | null | undefined): s is string =>
    typeof s === 'string' && s.length > 0

  if (!has(stateVerifier) && !has(requestVerifier)) return // 둘 다 없음 — 통과
  if (has(stateVerifier) !== has(requestVerifier)) {
    throw new MarketError('validation', 'PKCE codeVerifier 누락 / 불일치', {
      market: MARKET,
      marketErrorCode: 'pkce_mismatch',
    })
  }
  if (stateVerifier !== requestVerifier) {
    throw new MarketError('validation', 'PKCE codeVerifier 불일치', {
      market: MARKET,
      marketErrorCode: 'pkce_mismatch',
    })
  }
}

// ─────────────────────────────────────────────
// HTTP 상태 → MarketError 매핑
// ─────────────────────────────────────────────

export function naverHttpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403 || status === 400) {
    // OAuth code endpoint 는 400 도 invalid_grant 류 — unauthorized 로 묶음.
    return new MarketError(
      'unauthorized',
      `네이버 토큰 교환 실패 (${status})`,
      {
        market: MARKET,
        status,
        marketErrorMessage: message,
        marketErrorCode: String(status),
      },
    )
  }
  if (status === 429) {
    return new MarketError('rate_limit', '네이버 API rate limit 초과', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `네이버 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError(
    'unknown',
    `네이버 토큰 교환 오류 (${status}) correlationId=${correlationId}`,
    { market: MARKET, status, marketErrorMessage: message },
  )
}

// ─────────────────────────────────────────────
// exchangeNaverAuthCode — 메인 진입
// ─────────────────────────────────────────────

export interface ExchangeNaverAuthCodeInput {
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
  /** PKCE 사용 시 oauth_state.pkce_verifier 와 매칭된 값. */
  codeVerifier?: string
  correlationId: string
  logger: Logger
  /** 단위 테스트 주입용 fetch (기본 globalThis.fetch). */
  fetchImpl?: typeof fetch
  /** 단위 테스트 주입용 now (기본 new Date()). */
  now?: Date
}

export interface ExchangeNaverAuthCodeResult {
  tokenSet: TokenSet
}

/**
 * 네이버 OAuth code → token 교환.
 *
 * 입력 검증 / PKCE 매칭은 본 함수 진입 전 (index.ts) 에서 완료된 상태여야 한다.
 *
 * @throws MarketError('unauthorized') — code 만료 / invalid_grant
 * @throws MarketError('rate_limit')   — 429
 * @throws MarketError('server')       — 5xx / 응답 스키마 불일치
 * @throws MarketError('network')      — fetch 실패 / timeout
 */
export async function exchangeNaverAuthCode(
  input: ExchangeNaverAuthCodeInput,
): Promise<ExchangeNaverAuthCodeResult> {
  const {
    code,
    redirectUri,
    clientId,
    clientSecret,
    codeVerifier,
    correlationId,
    logger,
    fetchImpl = fetch,
    now,
  } = input

  if (!code || code.length === 0) {
    throw new MarketError('validation', '네이버: code 필수', {
      market: MARKET,
    })
  }
  if (!clientId || !clientSecret) {
    throw new MarketError(
      'validation',
      '네이버: client_id / client_secret 환경변수 누락',
      {
        market: MARKET,
        marketErrorCode: 'oauth_config_missing',
      },
    )
  }

  const form = new URLSearchParams()
  form.set('grant_type', 'authorization_code')
  form.set('client_id', clientId)
  form.set('client_secret', clientSecret)
  form.set('code', code)
  form.set('redirect_uri', redirectUri)
  if (codeVerifier) {
    form.set('code_verifier', codeVerifier)
  }

  logger.info(
    {
      market: MARKET,
      method: 'POST',
      url: `${NAVER_API_BASE}${NAVER_TOKEN_PATH}`,
      correlationId,
      pkce: codeVerifier ? 'on' : 'off',
    },
    '→ market request (oauth token exchange)',
  )

  const controller = new AbortController()
  const timerId = setTimeout(() => {
    controller.abort()
  }, TOKEN_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetchImpl(`${NAVER_API_BASE}${NAVER_TOKEN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Correlation-Id': correlationId,
      },
      body: form.toString(),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '네이버 토큰 교환 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '네이버 토큰 교환 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }

  const text = await response.text()
  logger.info(
    {
      market: MARKET,
      status: response.status,
      correlationId,
      bodyLen: text.length,
    },
    '← market response (oauth token exchange)',
  )

  if (!response.ok) {
    throw naverHttpStatusToMarketError(response.status, text, correlationId)
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new MarketError(
      'server',
      '네이버 토큰 응답 JSON 파싱 실패',
      { market: MARKET, status: response.status },
    )
  }

  const tokenSet = naverTokenResponseToTokenSet(json, now ? { now } : {})
  return { tokenSet }
}
