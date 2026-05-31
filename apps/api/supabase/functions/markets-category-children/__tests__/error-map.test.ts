import { describe, expect, it } from 'vitest'
import { marketErrorToHttp } from '../lib/error-map'

/**
 * markets-category-children — MarketError code → HTTP 매핑 회귀 가드.
 *
 * Edge 진입(index.ts)은 Deno specifier(npm:zod / gatewayFetch) 의존이라 Vitest 직접
 * import 불가 → 순수 매핑(error-map.ts)만 단위 검증한다. ownership 403 /
 * category_not_supported / 정상 children 등 핸들러 시퀀스는 Deno 통합(실 키 + 게이트웨이)
 * 또는 debug mock 런타임에서 검증.
 *
 * R-001: 성공 + 실패/엣지 동반.
 */
describe('marketErrorToHttp — MarketError code → HTTP status/code', () => {
  it('unauthorized → 401 market_unauthorized (재인증 필요)', () => {
    expect(marketErrorToHttp('unauthorized')).toEqual({
      status: 401,
      code: 'market_unauthorized',
    })
  })

  it('validation → 400 market_validation', () => {
    expect(marketErrorToHttp('validation')).toEqual({
      status: 400,
      code: 'market_validation',
    })
  })

  it('rate_limit → 429', () => {
    expect(marketErrorToHttp('rate_limit')).toEqual({
      status: 429,
      code: 'rate_limit',
    })
  })

  it('network/server/unknown → 502 market_bad_gateway (외부 도달/응답 문제)', () => {
    expect(marketErrorToHttp('network').status).toBe(502)
    expect(marketErrorToHttp('server').status).toBe(502)
    expect(marketErrorToHttp('unknown').status).toBe(502)
  })

  it('edge: 미지 코드도 502 로 보수적 매핑', () => {
    expect(marketErrorToHttp('totally_unexpected').status).toBe(502)
  })
})
