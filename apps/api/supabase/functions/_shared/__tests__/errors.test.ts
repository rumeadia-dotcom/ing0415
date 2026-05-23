import { describe, expect, it } from 'vitest'
import { HttpError, HttpErrors, MarketError } from '../errors'

/**
 * _shared/errors.ts 단위 테스트.
 *
 * 회귀 가드:
 * - hotfix/v0.9.8: HttpErrors.internal 가 details 인자 받지 않아 응답 body 에
 *   details 가 silently dropped 되던 버그.
 * - hotfix/v0.9.7 후속 (PR #110): unauthorized / forbidden / notFound / rateLimit
 *   도 details 인자 받도록 시그니처 일관화.
 *
 * 본 테스트가 깨지면 markets-* Edge Function 의 details 응답이 또 손실됨.
 */
describe('HttpErrors helper — status / code / message / details', () => {
  it('badRequest 는 status=400 + details 보존', () => {
    const e = HttpErrors.badRequest('validation', 'invalid body', {
      stage: 'authenticate',
      market: 'gmarket',
    })
    expect(e).toBeInstanceOf(HttpError)
    expect(e.status).toBe(400)
    expect(e.code).toBe('validation')
    expect(e.message).toBe('invalid body')
    expect(e.details).toEqual({ stage: 'authenticate', market: 'gmarket' })
  })

  it('unauthorized 는 status=401 + details 보존 (v0.9.10 신규 시그니처)', () => {
    const e = HttpErrors.unauthorized('invalid_code', 'market rejected the code', {
      stage: 'authenticate',
      market: 'naver',
      reason: 'unauthorized',
    })
    expect(e.status).toBe(401)
    expect(e.code).toBe('invalid_code')
    expect(e.details).toEqual({
      stage: 'authenticate',
      market: 'naver',
      reason: 'unauthorized',
    })
  })

  it('unauthorized 는 인자 없이 호출 시 기본값 유지 (회귀 가드)', () => {
    const e = HttpErrors.unauthorized()
    expect(e.status).toBe(401)
    expect(e.code).toBe('unauthorized')
    expect(e.message).toBe('authentication required')
    expect(e.details).toBeUndefined()
  })

  it('forbidden 는 status=403 + details 보존', () => {
    const e = HttpErrors.forbidden('access_denied', 'not allowed', {
      reason: 'rls_blocked',
    })
    expect(e.status).toBe(403)
    expect(e.code).toBe('access_denied')
    expect(e.details).toEqual({ reason: 'rls_blocked' })
  })

  it('notFound 는 status=404 + details 보존', () => {
    const e = HttpErrors.notFound('account_not_found', 'no such account', {
      stage: 'account_lookup',
    })
    expect(e.status).toBe(404)
    expect(e.code).toBe('account_not_found')
    expect(e.details).toEqual({ stage: 'account_lookup' })
  })

  it('conflict 는 status=409 + details 보존', () => {
    const e = HttpErrors.conflict('duplicate_label', 'label exists', {
      market: 'coupang',
      label: 'main',
    })
    expect(e.status).toBe(409)
    expect(e.code).toBe('duplicate_label')
    expect(e.details).toEqual({ market: 'coupang', label: 'main' })
  })

  it('rateLimit 는 status=429 + retryAfterMs + details 병합', () => {
    const e = HttpErrors.rateLimit(5000, { stage: 'authenticate', market: 'gmarket' })
    expect(e.status).toBe(429)
    expect(e.code).toBe('rate_limit')
    expect(e.details).toEqual({
      retryAfterMs: 5000,
      stage: 'authenticate',
      market: 'gmarket',
    })
  })

  it('rateLimit 는 인자 없이 호출해도 details 객체 보존 (retryAfterMs=undefined)', () => {
    const e = HttpErrors.rateLimit()
    expect(e.status).toBe(429)
    expect(e.details).toEqual({ retryAfterMs: undefined })
  })

  it('internal 은 status=500 + details 보존 (v0.9.8 회귀 가드)', () => {
    const e = HttpErrors.internal('category_ping_failed', 'category ping failed (unknown)', {
      stage: 'category_ping',
      market: 'gmarket',
      reason: 'unknown',
    })
    expect(e.status).toBe(500)
    expect(e.code).toBe('category_ping_failed')
    expect(e.details).toEqual({
      stage: 'category_ping',
      market: 'gmarket',
      reason: 'unknown',
    })
  })

  it('internal 은 인자 없이 호출 시 기본값', () => {
    const e = HttpErrors.internal()
    expect(e.status).toBe(500)
    expect(e.code).toBe('internal')
    expect(e.message).toBe('internal server error')
    expect(e.details).toBeUndefined()
  })
})

describe('MarketError — retryable 분류', () => {
  it('rate_limit / server / network 는 retryable=true', () => {
    for (const code of ['rate_limit', 'server', 'network'] as const) {
      const err = new MarketError(code, `${code} test`, { market: 'gmarket' })
      expect(err.retryable).toBe(true)
    }
  })

  it('unauthorized / validation / unknown 는 retryable=false', () => {
    for (const code of ['unauthorized', 'validation', 'unknown'] as const) {
      const err = new MarketError(code, `${code} test`, { market: 'gmarket' })
      expect(err.retryable).toBe(false)
    }
  })

  it('context 보존 — market + status + cause', () => {
    const cause = new Error('original')
    const err = new MarketError('server', '서버 5xx', {
      market: 'coupang',
      status: 503,
      cause,
    })
    expect(err.code).toBe('server')
    expect(err.message).toBe('서버 5xx')
    expect(err.context.market).toBe('coupang')
    expect(err.context.status).toBe(503)
    expect(err.context.cause).toBe(cause)
  })
})
