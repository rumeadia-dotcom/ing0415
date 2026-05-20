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
    'market_unavailable',
    'job_in_progress',
    'not_retryable',
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
})

describe('formatValidationIssue', () => {
  it('정의된 issue code 매핑', () => {
    expect(formatValidationIssue('product_name_invalid')).toMatch(/상품명/)
    expect(formatValidationIssue('image_main_missing')).toMatch(/대표 이미지/)
    expect(formatValidationIssue('token_expired')).toMatch(/재인증/)
  })

  it('알 수 없는 issue code 는 폴백', () => {
    expect(formatValidationIssue('something_new')).toBe('입력값을 확인해 주세요.')
  })
})
