import { describe, it, expect } from 'vitest'
import {
  formatMarketError,
  MARKET_ERROR_MESSAGES,
  MARKET_LABEL,
  STAGE_HINT,
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
    'credentials_unauthorized',
    'credentials_invalid',
    'market_network',
    'market_server',
    'category_ping_failed',
    'invalid_credentials',
  ]

  it.each(allCodes)('%s 코드는 한국어 메시지가 매핑된다', (code) => {
    const result = formatMarketError({
      code,
      message: 'raw',
      correlationId: '00000000-0000-0000-0000-000000000000',
    })
    expect(result.code).toBe(code)
    expect(result.message).toBe(MARKET_ERROR_MESSAGES[code])
    expect(result.correlationId).toBe('00000000-0000-0000-0000-000000000000')
    expect(result.hint).toBeNull()
  })

  it('알 수 없는 code 는 unknown 으로 폴백', () => {
    const result = formatMarketError({ code: 'something_new', message: 'x', correlationId: 'abc' })
    expect(result.code).toBe('unknown')
    expect(result.message).toBe(MARKET_ERROR_MESSAGES.unknown)
  })

  it('null/undefined 입력은 unknown + correlationId null + hint null', () => {
    expect(formatMarketError(null)).toEqual({
      code: 'unknown',
      message: MARKET_ERROR_MESSAGES.unknown,
      correlationId: null,
      hint: null,
    })
    expect(formatMarketError(undefined)).toEqual({
      code: 'unknown',
      message: MARKET_ERROR_MESSAGES.unknown,
      correlationId: null,
      hint: null,
    })
  })

  it('correlationId 누락은 null', () => {
    expect(formatMarketError({ code: 'internal', message: '' }).correlationId).toBeNull()
  })

  // ─────────────────────────────────────────────
  // v0.9.7 신규 — details.market / stage prefix
  // ─────────────────────────────────────────────

  it('details.market 가 있으면 메시지에 마켓명 prefix 부착', () => {
    const result = formatMarketError({
      code: 'credentials_unauthorized',
      message: 'raw',
      details: { market: 'gmarket', stage: 'authenticate', reason: 'unauthorized' },
    })
    expect(result.message).toContain(MARKET_LABEL.gmarket)
    expect(result.message).toContain('자격증명이 거부')
  })

  it('알려지지 않은 market 키는 raw 값을 그대로 prefix 로 사용', () => {
    const result = formatMarketError({
      code: 'market_network',
      message: 'raw',
      details: { market: 'unknown_market' },
    })
    expect(result.message.startsWith('[unknown_market]')).toBe(true)
  })

  it('details.stage 가 있으면 hint 에 단계 안내', () => {
    const result = formatMarketError({
      code: 'category_ping_failed',
      message: 'raw',
      details: { stage: 'category_ping', market: 'gmarket', reason: 'network' },
    })
    expect(result.hint).toBe(STAGE_HINT.category_ping)
  })

  it('알려지지 않은 stage 는 hint null', () => {
    const result = formatMarketError({
      code: 'internal',
      message: 'raw',
      // @ts-expect-error — 잘못된 stage 값 테스트
      details: { stage: 'unknown_stage' },
    })
    expect(result.hint).toBeNull()
  })

  it('credentials_unauthorized 는 5마켓 전부에 마켓명 prefix 정합', () => {
    const markets = ['naver', 'coupang', 'gmarket', 'auction', '11st'] as const
    for (const m of markets) {
      const r = formatMarketError({
        code: 'credentials_unauthorized',
        message: 'raw',
        details: { market: m },
      })
      expect(r.message).toContain(MARKET_LABEL[m])
    }
  })
})
