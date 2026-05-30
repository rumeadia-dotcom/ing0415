/**
 * Market Gateway — pure 서명/검증 모듈 단위 테스트.
 *
 * 검증 대상: gateway-sign.ts (Deno-specific 의존 없음 → vitest 환경에서 직접 import).
 * 마스터: docs/architecture/v1/cross-cutting/market-gateway.md §4.2
 *
 * 시나리오:
 *   1) isGatewayMarket — 5 valid + invalid
 *   2) buildSignPayload — 결정적 직렬화
 *   3) hmacSignHex — 결정성 + 입력 변경 시 출력 변경 (collision-resistance smoke)
 *   4) assertGatewayUrl — invalid url / unsupported protocol / non-whitelisted host
 *   5) maskUrlForLog — querystring 제거 + 11번가 reqdelivery 송장/dlvNo path segment 마스킹 (PR-6 보안)
 *   6) classifyGatewayStatus — 6 가지 분류
 */

import { describe, expect, it } from 'vitest'
import {
  GATEWAY_ALLOWED_HOSTS,
  GATEWAY_ALLOWED_MARKETS,
  assertGatewayUrl,
  buildSignPayload,
  classifyGatewayStatus,
  hmacSignHex,
  isGatewayMarket,
  maskUrlForLog,
} from '../gateway-sign'

describe('gateway-sign / isGatewayMarket', () => {
  it('5 마켓 (naver / coupang / gmarket / auction / 11st) 모두 true', () => {
    for (const m of GATEWAY_ALLOWED_MARKETS) expect(isGatewayMarket(m)).toBe(true)
  })

  it('알려지지 않은 마켓은 false', () => {
    expect(isGatewayMarket('amazon')).toBe(false)
    expect(isGatewayMarket('')).toBe(false)
    expect(isGatewayMarket('NAVER')).toBe(false) // case-sensitive
  })
})

describe('gateway-sign / buildSignPayload', () => {
  it('동일 입력 → 동일 출력 (결정적)', () => {
    const input = { ts: '1716370000000', market: 'naver' as const, url: 'https://api.commerce.naver.com/x', body: '{"a":1}' }
    expect(buildSignPayload(input)).toBe(buildSignPayload(input))
  })

  it('payload 형식: ts + market + url + body 순서로 단순 concat', () => {
    expect(
      buildSignPayload({ ts: '1', market: 'naver', url: 'U', body: 'B' }),
    ).toBe('1naverUB')
  })

  it('빈 body 도 허용 (GET 요청)', () => {
    expect(
      buildSignPayload({ ts: '1', market: 'coupang', url: 'U', body: '' }),
    ).toBe('1coupangU')
  })
})

describe('gateway-sign / hmacSignHex', () => {
  it('동일 입력 → 동일 서명 (결정적)', async () => {
    const sig1 = await hmacSignHex('s'.repeat(32), 'payload')
    const sig2 = await hmacSignHex('s'.repeat(32), 'payload')
    expect(sig1).toBe(sig2)
  })

  it('SHA-256 출력 길이 = 64 (hex)', async () => {
    const sig = await hmacSignHex('s'.repeat(32), 'payload')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('payload 가 1 byte 만 바뀌어도 서명 완전 변경', async () => {
    const a = await hmacSignHex('k'.repeat(32), 'payload-A')
    const b = await hmacSignHex('k'.repeat(32), 'payload-B')
    expect(a).not.toBe(b)
  })

  it('secret 이 다르면 서명 다름', async () => {
    const a = await hmacSignHex('a'.repeat(32), 'payload')
    const b = await hmacSignHex('b'.repeat(32), 'payload')
    expect(a).not.toBe(b)
  })

  it('ts / market / url / body 중 하나만 바뀌어도 최종 서명 다름', async () => {
    const secret = 'k'.repeat(32)
    const base = { ts: '100', market: 'naver' as const, url: 'https://api.commerce.naver.com/x', body: '{}' }
    const sig0 = await hmacSignHex(secret, buildSignPayload(base))
    const sigTs = await hmacSignHex(secret, buildSignPayload({ ...base, ts: '101' }))
    const sigMarket = await hmacSignHex(secret, buildSignPayload({ ...base, market: 'coupang' }))
    const sigUrl = await hmacSignHex(secret, buildSignPayload({ ...base, url: 'https://api.commerce.naver.com/y' }))
    const sigBody = await hmacSignHex(secret, buildSignPayload({ ...base, body: '{"a":1}' }))

    expect(new Set([sig0, sigTs, sigMarket, sigUrl, sigBody]).size).toBe(5)
  })
})

describe('gateway-sign / assertGatewayUrl', () => {
  it('whitelisted 호스트는 통과', () => {
    expect(() => assertGatewayUrl('https://api.commerce.naver.com/products')).not.toThrow()
    expect(() => assertGatewayUrl('https://api-gateway.coupang.com/v2/x')).not.toThrow()
    expect(() => assertGatewayUrl('https://sa.esmplus.com/api/v1/x')).not.toThrow()
    // ESM sa2 (현행 base, esm.md §0/§7): PR-2 카테고리·상품 + PR-3 배송 프로필 Edge 실호출 대상.
    expect(() =>
      assertGatewayUrl('https://sa2.esmplus.com/item/v1/categories/site-cats'),
    ).not.toThrow()
    expect(() => assertGatewayUrl('https://sa2.esmplus.com/item/v1/sellers/address')).not.toThrow()
    expect(() => assertGatewayUrl('https://openapi.11st.co.kr/openapi/OpenApiService.tmall')).not.toThrow()
    // 11번가 실제 REST base (PR-0, spec import #265) — features/11st.md §4.
    expect(() => assertGatewayUrl('https://api.11st.co.kr/rest/cateservice/category')).not.toThrow()
    expect(() => assertGatewayUrl('https://api.11st.co.kr/rest/prodservices/product')).not.toThrow()
  })

  it('invalid URL → throw', () => {
    expect(() => assertGatewayUrl('not-a-url')).toThrow(/invalid url/)
  })

  it('지원하지 않는 프로토콜 → throw', () => {
    expect(() => assertGatewayUrl('ftp://api.commerce.naver.com/x')).toThrow(/unsupported protocol/)
  })

  it('화이트리스트 외 호스트 → throw (SSRF 방어)', () => {
    expect(() => assertGatewayUrl('https://evil.example.com/steal')).toThrow(/host not in allow-list/)
    // 비슷한 서브도메인도 차단
    expect(() => assertGatewayUrl('https://api.commerce.naver.com.evil.com/x')).toThrow(/host not in allow-list/)
  })

  it('GATEWAY_ALLOWED_HOSTS 는 정확히 6종 (naver/coupang + ESM sa2·sa + 11번가 api·openapi)', () => {
    // ESM 은 sa2(현행 base, G+옥션 공유)·sa(레거시 호환) 2개 호스트.
    // 11번가는 api.11st.co.kr(실제 REST base, PR-0~)·openapi.11st.co.kr(구 placeholder) 2개 병존 —
    // 호출부 재작성(PR-1~5) 완료 후 openapi 제거 예정 (features/11st.md §4).
    expect(GATEWAY_ALLOWED_HOSTS.size).toBe(6)
    expect(GATEWAY_ALLOWED_HOSTS.has('sa2.esmplus.com')).toBe(true)
    expect(GATEWAY_ALLOWED_HOSTS.has('api.11st.co.kr')).toBe(true)
  })
})

describe('gateway-sign / maskUrlForLog', () => {
  it('querystring 제거', () => {
    expect(maskUrlForLog('https://api.commerce.naver.com/products?token=secret&id=1')).toBe(
      'https://api.commerce.naver.com/products',
    )
  })

  it('querystring 없으면 그대로', () => {
    expect(maskUrlForLog('https://openapi.11st.co.kr/openapi/OpenApiService.tmall')).toBe(
      'https://openapi.11st.co.kr/openapi/OpenApiService.tmall',
    )
  })

  it('invalid URL → <invalid-url>', () => {
    expect(maskUrlForLog('not-a-url')).toBe('<invalid-url>')
  })

  // PR-6 보안: 11번가 발송처리(1888) path 가 송장번호(invcNo)·배송번호(dlvNo)를 path segment 로
  // 포함 → reqdelivery 이후 segment 마스킹 (게이트웨이 로그 송장 노출 차단).
  it('11번가 reqdelivery path 의 송장/dlvNo segment 마스킹 (보안)', () => {
    const url =
      'https://api.11st.co.kr/rest/ordservices/reqdelivery/202605301230/01/00002/1234567890123/987654321'
    const masked = maskUrlForLog(url)
    // reqdelivery 까지만 보존, 이후 전부 가림.
    expect(masked).toBe(
      'https://api.11st.co.kr/rest/ordservices/reqdelivery/<masked>',
    )
    // 송장번호·dlvNo 가 로그에 남지 않음.
    expect(masked).not.toContain('1234567890123') // invcNo
    expect(masked).not.toContain('987654321') // dlvNo
  })

  it('reqdelivery query string 도 함께 제거', () => {
    expect(
      maskUrlForLog(
        'https://api.11st.co.kr/rest/ordservices/reqdelivery/202605301230/01/00002/INV1/DLV1?key=secret',
      ),
    ).toBe('https://api.11st.co.kr/rest/ordservices/reqdelivery/<masked>')
  })

  it('reqdelivery 가 아닌 11번가 path 는 그대로 (과잉 마스킹 방지)', () => {
    expect(
      maskUrlForLog('https://api.11st.co.kr/rest/ordservices/complete/202605300000/202605302359'),
    ).toBe('https://api.11st.co.kr/rest/ordservices/complete/202605300000/202605302359')
    expect(maskUrlForLog('https://api.11st.co.kr/rest/prodservices/product')).toBe(
      'https://api.11st.co.kr/rest/prodservices/product',
    )
  })
})

describe('gateway-sign / classifyGatewayStatus', () => {
  it('401 → auth_mismatch (HMAC 거부)', () => {
    expect(classifyGatewayStatus(401)).toBe('auth_mismatch')
  })

  it('403 → forbidden (화이트리스트 거부)', () => {
    expect(classifyGatewayStatus(403)).toBe('forbidden')
  })

  it('502 / 504 → upstream_network', () => {
    expect(classifyGatewayStatus(502)).toBe('upstream_network')
    expect(classifyGatewayStatus(504)).toBe('upstream_network')
  })

  it('500 / 503 → upstream_server', () => {
    expect(classifyGatewayStatus(500)).toBe('upstream_server')
    expect(classifyGatewayStatus(503)).toBe('upstream_server')
  })

  it('400 / 404 / 429 → upstream_client (마켓이 4xx 그대로 반환)', () => {
    expect(classifyGatewayStatus(400)).toBe('upstream_client')
    expect(classifyGatewayStatus(404)).toBe('upstream_client')
    expect(classifyGatewayStatus(429)).toBe('upstream_client')
  })

  it('2xx / 3xx → unknown (성공/리다이렉트는 본 분류 대상 아님)', () => {
    expect(classifyGatewayStatus(200)).toBe('unknown')
    expect(classifyGatewayStatus(302)).toBe('unknown')
  })
})
