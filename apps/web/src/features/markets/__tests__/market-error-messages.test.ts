import { describe, it, expect } from 'vitest'
import {
  formatMarketError,
  MARKET_ERROR_MESSAGES,
  type MarketErrorCode,
} from '../utils/market-error-messages'

describe('formatMarketError', () => {
  const allCodes: MarketErrorCode[] = [
    'market_not_supported',
    'invalid_redirect',
    'duplicate_label',
    'invalid_state',
    'invalid_code',
    'oauth_denied',
    'market_unavailable',
    'rate_limited',
    'vault_unavailable',
    'forbidden',
    'not_found',
    'unauthorized',
    'internal',
    'unknown',
  ]

  it.each(allCodes)('%s 코드는 한국어 메시지가 매핑된다', (code) => {
    const result = formatMarketError({ code, message: 'raw', correlationId: '00000000-0000-0000-0000-000000000000' })
    expect(result.code).toBe(code)
    expect(result.message).toBe(MARKET_ERROR_MESSAGES[code])
    expect(result.correlationId).toBe('00000000-0000-0000-0000-000000000000')
  })

  it('알 수 없는 code 는 unknown 으로 폴백', () => {
    const result = formatMarketError({ code: 'something_new', message: 'x', correlationId: 'abc' })
    expect(result.code).toBe('unknown')
    expect(result.message).toBe(MARKET_ERROR_MESSAGES.unknown)
  })

  it('null/undefined 입력은 unknown + correlationId null', () => {
    expect(formatMarketError(null)).toEqual({
      code: 'unknown',
      message: MARKET_ERROR_MESSAGES.unknown,
      correlationId: null,
    })
    expect(formatMarketError(undefined)).toEqual({
      code: 'unknown',
      message: MARKET_ERROR_MESSAGES.unknown,
      correlationId: null,
    })
  })

  it('correlationId 누락은 null', () => {
    expect(formatMarketError({ code: 'internal', message: '' }).correlationId).toBeNull()
  })
})
