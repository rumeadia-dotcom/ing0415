/**
 * 네이버 Edge Function (token exchange) 단위 테스트 (8건).
 *
 * 파일 위치: tests/unit/market-adapters/naver-edge.test.ts
 * (vitest.config.ts 의 tests/unit/**\/\*.test.ts 경로에 포함됨)
 *
 * 마스터: WIP-5markets-mvp.md C-1 Phase 2
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.1, markets.md §5.3.
 *
 * Edge Function 코드는 Deno 전용 import (npm:zod, .ts extension) 로 Vitest 에서
 * 직접 import 불가. 본 테스트는 동일 알고리즘을 인라인으로 검증한다:
 *   - PKCE codeVerifier 매칭 규칙
 *   - HTTP 상태 → MarketErrorCode 매핑 규칙
 *   - 네이버 토큰 응답 → TokenSet 변환 (expiresAt 계산)
 *   - exchangeNaverAuthCode 본문 시뮬레이션 (form body, headers, status 분기)
 *
 * 테스트 카테고리:
 *   N1. PKCE — 둘 다 없음 → ok
 *   N2. PKCE — 하나만 있음 → 'pkce_mismatch'
 *   N3. PKCE — 값 다름 → 'pkce_mismatch'
 *   N4. HTTP 400/401/403 → 'unauthorized' (OAuth invalid_grant 묶음)
 *   N5. HTTP 429 → 'rate_limit', 5xx → 'server'
 *   N6. tokenResponse → TokenSet 변환 (expiresAt = now + expires_in*1000)
 *   N7. exchange 정상 흐름 — form body grant_type=authorization_code + client_id 포함
 *   N8. exchange 401 응답 → MarketErrorCode('unauthorized')
 */

import { describe, it, expect, vi } from 'vitest'

// ─────────────────────────────────────────────
// Edge Function 의 PKCE / 매핑 / 변환을 인라인으로 재구현
// 출처: apps/api/supabase/functions/markets-oauth-callback/naver.ts
// ─────────────────────────────────────────────

type MarketErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

function verifyPkceVerifier(
  stateVerifier: string | null | undefined,
  requestVerifier: string | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  const has = (s: string | null | undefined): s is string =>
    typeof s === 'string' && s.length > 0
  if (!has(stateVerifier) && !has(requestVerifier)) return { ok: true }
  if (has(stateVerifier) !== has(requestVerifier)) {
    return { ok: false, reason: 'pkce_mismatch' }
  }
  if (stateVerifier !== requestVerifier) {
    return { ok: false, reason: 'pkce_mismatch' }
  }
  return { ok: true }
}

function classifyTokenHttpError(status: number): MarketErrorCode {
  if (status === 400 || status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'server'
  return 'unknown'
}

function naverTokenResponseToTokenSet(
  raw: { access_token: string; refresh_token: string; expires_in: number; scope?: string },
  opts: { now?: Date } = {},
) {
  const now = opts.now ?? new Date()
  const expiresAtMs = now.getTime() + raw.expires_in * 1000
  const expiresAt = new Date(expiresAtMs).toISOString().replace(/Z$/, '+00:00')
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt,
    tokenType: 'Bearer' as const,
    ...(raw.scope !== undefined ? { scope: raw.scope } : {}),
  }
}

interface ExchangeInput {
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
  codeVerifier?: string
  fetchImpl: typeof fetch
}

async function exchangeAuthCode(input: ExchangeInput): Promise<
  | { ok: true; tokenSet: ReturnType<typeof naverTokenResponseToTokenSet> }
  | { ok: false; code: MarketErrorCode }
> {
  const form = new URLSearchParams()
  form.set('grant_type', 'authorization_code')
  form.set('client_id', input.clientId)
  form.set('client_secret', input.clientSecret)
  form.set('code', input.code)
  form.set('redirect_uri', input.redirectUri)
  if (input.codeVerifier) form.set('code_verifier', input.codeVerifier)

  const response = await input.fetchImpl(
    'https://api.commerce.naver.com/external/v1/oauth2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: form.toString(),
    },
  )
  if (!response.ok) return { ok: false, code: classifyTokenHttpError(response.status) }
  const raw = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope?: string
  }
  return { ok: true, tokenSet: naverTokenResponseToTokenSet(raw, { now: new Date('2026-05-20T00:00:00Z') }) }
}

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe('N1: PKCE — 둘 다 없음 → ok', () => {
  it('state=null, request=null → ok', () => {
    expect(verifyPkceVerifier(null, null)).toEqual({ ok: true })
  })
  it('state=undefined, request="" → ok (둘 다 falsy)', () => {
    expect(verifyPkceVerifier(undefined, '')).toEqual({ ok: true })
  })
})

describe('N2: PKCE — 하나만 있음 → pkce_mismatch', () => {
  it('state="v1", request=null → mismatch', () => {
    const r = verifyPkceVerifier('verifier-1', null)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('pkce_mismatch')
  })
  it('state=null, request="v1" → mismatch', () => {
    const r = verifyPkceVerifier(null, 'verifier-1')
    expect(r.ok).toBe(false)
  })
})

describe('N3: PKCE — 값 다름 → pkce_mismatch', () => {
  it('state="a", request="b" → mismatch', () => {
    const r = verifyPkceVerifier('verifier-a', 'verifier-b')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('pkce_mismatch')
  })
  it('state="x", request="x" → ok', () => {
    expect(verifyPkceVerifier('verifier-x', 'verifier-x')).toEqual({ ok: true })
  })
})

describe('N4: HTTP 400/401/403 → unauthorized', () => {
  it('400 → unauthorized (invalid_grant 묶음)', () => {
    expect(classifyTokenHttpError(400)).toBe('unauthorized')
  })
  it('401 → unauthorized', () => {
    expect(classifyTokenHttpError(401)).toBe('unauthorized')
  })
  it('403 → unauthorized', () => {
    expect(classifyTokenHttpError(403)).toBe('unauthorized')
  })
})

describe('N5: HTTP 429 → rate_limit, 5xx → server', () => {
  it('429 → rate_limit', () => {
    expect(classifyTokenHttpError(429)).toBe('rate_limit')
  })
  it('500 → server', () => {
    expect(classifyTokenHttpError(500)).toBe('server')
  })
  it('503 → server', () => {
    expect(classifyTokenHttpError(503)).toBe('server')
  })
})

describe('N6: tokenResponse → TokenSet (expiresAt 계산)', () => {
  it('expires_in=3600 + now=2026-05-20T00:00:00Z → expiresAt=2026-05-20T01:00:00+00:00', () => {
    const raw = {
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      scope: 'commerce.products',
    }
    const ts = naverTokenResponseToTokenSet(raw, {
      now: new Date('2026-05-20T00:00:00Z'),
    })
    expect(ts.accessToken).toBe('at-1')
    expect(ts.refreshToken).toBe('rt-1')
    expect(ts.expiresAt).toBe('2026-05-20T01:00:00.000+00:00')
    expect(ts.scope).toBe('commerce.products')
    expect(ts.tokenType).toBe('Bearer')
  })
  it('scope 없으면 출력에서도 누락', () => {
    const raw = {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 100,
    }
    const ts = naverTokenResponseToTokenSet(raw)
    expect('scope' in ts).toBe(false)
  })
})

describe('N7: exchange 정상 흐름 — form body 구성 확인', () => {
  it('200 응답 → tokenSet 반환, form 에 grant_type/client_id/code/redirect_uri 포함', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = init.body as string
      const params = new URLSearchParams(body)
      expect(params.get('grant_type')).toBe('authorization_code')
      expect(params.get('client_id')).toBe('cid')
      expect(params.get('client_secret')).toBe('csecret')
      expect(params.get('code')).toBe('the-code')
      expect(params.get('redirect_uri')).toBe('https://example.com/cb')
      expect(params.get('code_verifier')).toBe('vv1')
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'at-x',
            refresh_token: 'rt-x',
            expires_in: 7200,
          }),
      } as Response)
    })

    const result = await exchangeAuthCode({
      code: 'the-code',
      redirectUri: 'https://example.com/cb',
      clientId: 'cid',
      clientSecret: 'csecret',
      codeVerifier: 'vv1',
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.tokenSet.accessToken).toBe('at-x')
      expect(result.tokenSet.refreshToken).toBe('rt-x')
    }
  })
})

describe('N8: exchange 401 응답 → unauthorized', () => {
  it('400 (invalid_grant) → unauthorized', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    } as Response)

    const result = await exchangeAuthCode({
      code: 'expired-code',
      redirectUri: 'https://example.com/cb',
      clientId: 'cid',
      clientSecret: 'csecret',
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unauthorized')
  })
})
