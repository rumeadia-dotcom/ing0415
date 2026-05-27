import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildCoupangSignature,
  formatCoupangDatetime,
} from '../coupang-hmac'

/**
 * 쿠팡 HMAC 서명 (Edge / Deno 측) 회귀 가드.
 *
 * 운영 사고 (2026-05-27, credentials_unauthorized): 서명 메시지가
 * `datetime\nMETHOD\npath\n` (개행) 으로 만들어져 쿠팡 401. 공식 스펙은
 * `datetime + method + path + query` 무개행 연결.
 * 출처: developers.coupangcorp.com "Creating HMAC Signature".
 *
 * coupang-hmac.ts 는 Deno-only import 없음(global crypto.subtle / TextEncoder)
 * → Vitex 에서 실모듈 직접 검증 가능.
 */
const FIXED_DATE = new Date('2026-05-20T09:30:45.000Z') // 260520T093045Z
const SECRET = 'test-secret-key-xyz789'

describe('coupang-hmac (Edge) — KAT', () => {
  it('datetime 포맷 YYMMDDTHHmmssZ', () => {
    expect(formatCoupangDatetime(FIXED_DATE)).toBe('260520T093045Z')
  })

  it('서명 = HMAC(secret, datetime+method+path) 무개행 (query 없음)', async () => {
    const path =
      '/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/0'
    const { signature } = await buildCoupangSignature({
      method: 'GET',
      path,
      accessKey: 'ak',
      secretKey: SECRET,
      now: FIXED_DATE,
    })
    const expected = createHmac('sha256', SECRET)
      .update(`260520T093045Z` + `GET` + path)
      .digest('hex')
    expect(signature).toBe(expected)
  })

  it('query 가 있으면 ? 를 떼고 datetime+method+path+query 로 서명', async () => {
    const { signature } = await buildCoupangSignature({
      method: 'POST',
      path: '/v2/x?a=1&b=2',
      accessKey: 'ak',
      secretKey: SECRET,
      now: FIXED_DATE,
    })
    const expected = createHmac('sha256', SECRET)
      .update(`260520T093045Z` + `POST` + `/v2/x` + `a=1&b=2`)
      .digest('hex')
    expect(signature).toBe(expected)
  })
})
