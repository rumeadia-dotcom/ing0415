import { describe, it, expect } from 'vitest'
import { mapAuthError } from '../auth-error-map'

describe('mapAuthError', () => {
  it('invalid_credentials code 매핑', () => {
    const result = mapAuthError({
      code: 'invalid_credentials',
      message: 'Invalid login credentials',
      status: 400,
    })
    expect(result.code).toBe('invalid_credentials')
    expect(result.message).toBe('이메일 또는 비밀번호가 올바르지 않습니다')
    expect(result.shouldReport).toBe(false)
  })

  it('email_not_confirmed 매핑 (message 매치)', () => {
    const result = mapAuthError({ message: 'Email not confirmed', status: 400 })
    expect(result.code).toBe('email_not_confirmed')
    expect(result.shouldReport).toBe(false)
  })

  it('429 rate limit 매핑', () => {
    const result = mapAuthError({
      code: 'over_email_send_rate_limit',
      message: 'rate limit',
      status: 429,
    })
    expect(result.code).toBe('over_rate_limit')
    expect(result.message).toContain('잠시 후')
  })

  it('네트워크 에러 (TypeError fetch)', () => {
    const result = mapAuthError(new TypeError('Failed to fetch'))
    expect(result.code).toBe('network')
    expect(result.shouldReport).toBe(false)
  })

  it('5xx 서버 에러는 Sentry 송출', () => {
    const result = mapAuthError({ message: 'internal', status: 503 })
    expect(result.code).toBe('server')
    expect(result.shouldReport).toBe(true)
  })

  it('알 수 없는 에러는 unknown + details + 송출', () => {
    const result = mapAuthError(new Error('weird boom'))
    expect(result.code).toBe('unknown')
    expect(result.shouldReport).toBe(true)
    expect(result.details).toContain('weird boom')
  })

  it('user_already_exists 는 enumeration 방지 — Sentry 송출 안 함', () => {
    const result = mapAuthError({
      code: 'user_already_exists',
      message: 'User already registered',
      status: 400,
    })
    expect(result.code).toBe('user_already_exists')
    expect(result.shouldReport).toBe(false)
  })
})
