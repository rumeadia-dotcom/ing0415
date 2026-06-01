import { describe, it, expect } from 'vitest'
import {
  formatRegistrationError,
  formatValidationIssue,
  REGISTRATION_ERROR_MESSAGES,
  type RegistrationErrorCode,
} from '../utils/registration-error-messages'

describe('formatRegistrationError', () => {
  const codes: RegistrationErrorCode[] = [
    'invalid_request',
    'unauthorized',
    'forbidden_product',
    'product_not_found',
    'job_not_found',
    'market_unavailable',
    'job_in_progress',
    'market_not_connected',
    'not_retryable',
    'job_not_retryable',
    'no_retry_targets',
    'retry_exceeded',
    'already_finalized',
    'rate_limited',
    'internal',
    'unknown',
  ]

  it.each(codes)('%s 코드는 한국어 메시지 매핑', (code) => {
    const r = formatRegistrationError({ code, correlationId: '00000000-0000-0000-0000-000000000aaa' })
    expect(r.code).toBe(code)
    expect(r.message).toBe(REGISTRATION_ERROR_MESSAGES[code])
    expect(r.correlationId).toBe('00000000-0000-0000-0000-000000000aaa')
  })

  it('알 수 없는 code 는 unknown 으로 폴백', () => {
    const r = formatRegistrationError({ code: 'xxx_new', correlationId: null })
    expect(r.code).toBe('unknown')
    expect(r.message).toBe(REGISTRATION_ERROR_MESSAGES.unknown)
    expect(r.correlationId).toBeNull()
  })

  it('null 입력은 unknown + null', () => {
    expect(formatRegistrationError(null)).toEqual({
      code: 'unknown',
      message: REGISTRATION_ERROR_MESSAGES.unknown,
      correlationId: null,
    })
  })

  // R4: backend(registration-start/preflight, registration-retry)가 실제 발행하는 code 들.
  // 누락 시 'unknown' 폴백 → 셀러가 무엇을 고쳐야 할지 모르는 generic 에러.
  it.each(['market_not_connected', 'job_not_retryable', 'no_retry_targets'])(
    '%s 는 전용 메시지 — unknown 폴백 아님',
    (code) => {
      const r = formatRegistrationError({ code, correlationId: null })
      expect(r.code).toBe(code)
      expect(r.message).not.toBe(REGISTRATION_ERROR_MESSAGES.unknown)
    },
  )
})

describe('formatValidationIssue', () => {
  it('정의된 issue code 매핑', () => {
    expect(formatValidationIssue('product_name_invalid')).toMatch(/상품명/)
    expect(formatValidationIssue('image_main_missing')).toMatch(/대표 이미지/)
    expect(formatValidationIssue('token_expired')).toMatch(/재인증/)
  })

  it('description_html_unsafe (XSS dual-defense §13.5) 는 전용 메시지 — 폴백 아님', () => {
    const msg = formatValidationIssue('description_html_unsafe')
    expect(msg).toMatch(/HTML/)
    expect(msg).not.toBe('입력값을 확인해 주세요.')
  })

  it('알 수 없는 issue code 는 폴백', () => {
    expect(formatValidationIssue('something_new')).toBe('입력값을 확인해 주세요.')
  })
})
