/**
 * Edge Function 마스킹 회귀 테스트 — `apps/api/supabase/functions/_shared/masking.ts`.
 *
 * 출처 / 근거:
 *   - 작업 카드: D-D (WIP-5markets-mvp.md Phase 4)
 *   - 마스터: docs/architecture/v1/security.md §6.1 / §6.2 / §6.3
 *             docs/architecture/v1/cross-cutting/credential-vault.md §7.1
 *   - CLAUDE.md "외부 API 로깅 패턴" — 마스터 키 / 토큰 / PII 로그 금지
 *
 * 목적:
 *   FE redact 와 동일 매트릭스 15건 + Edge 고유 키 (encrypted_*, master_key,
 *   pkce_verifier 등) 검증. `maskRecord` / `maskError` 두 진입을 모두 잠근다.
 *
 * 배치 결정:
 *   `apps/api/supabase/functions/_shared/masking.ts` 는 외부 import 없는 순수 모듈이라
 *   Vitest 가 직접 컴파일 가능. vitest.config 의 `tests/unit/` 매처에 들어가도록 본 파일을 둠.
 *
 * 시나리오 매트릭스 (15건 + Edge 전용 3건):
 *   E1.  OAuth access_token (JWT)
 *   E2.  refresh_token
 *   E3.  쿠팡 accessKey (HMAC)
 *   E4.  쿠팡 secretKey
 *   E5.  쿠팡 vendorId
 *   E6.  ESM masterId
 *   E7.  email
 *   E8.  password
 *   E9.  phone
 *   E10. 사업자등록번호
 *   E11. Authorization 헤더 (Bearer 패턴)
 *   E12. OAuth code (URL query)
 *   E13. 중첩 객체 credentials.accessKey
 *   E14. 배열 안의 JWT
 *   E15. sellerId (UUID) → 마스킹 안 됨
 *   E16. encrypted_access_token (Edge 전용 ciphertext)
 *   E17. master_key (pgcrypto 마스터 키)
 *   E18. maskError(Error) — message / context / stack 마스킹
 */

import { describe, it, expect } from 'vitest'

import { maskRecord, maskError } from '../../../apps/api/supabase/functions/_shared/masking'

function expectMaskedString(out: unknown, opts?: { isJwt?: boolean; isBearer?: boolean }): void {
  expect(typeof out).toBe('string')
  const s = out as string
  if (opts?.isBearer) {
    // Authorization 헤더 본문은 Bearer 토큰 부분만 마스킹 (키가 'authorization' 면 전체 마스킹).
    expect(s).toMatch(/\[REDACT/)
    return
  }
  expect(s).toMatch(/^\[REDACT/)
  if (opts?.isJwt) {
    expect(s).toMatch(/^\[REDACT:jwt:len=\d+\]$/)
  }
}

describe('maskRecord() — Edge Function PII 마스킹 회귀 (D-D Phase 4)', () => {
  // ─── E1. OAuth access_token (JWT) ─────────────────────────────
  it('E1: access_token (JWT) → 마스킹', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature_xxx'
    const out = maskRecord({ access_token: jwt }) as Record<string, unknown>
    expectMaskedString(out.access_token)
    expect(JSON.stringify(out)).not.toContain('eyJzdWIiOiIxMjM0NTY3ODkw')
  })

  // ─── E2. refresh_token ─────────────────────────────
  it('E2: refresh_token → 마스킹', () => {
    const out = maskRecord({ refresh_token: 'rt_naver_xxx_yyy_zzz' }) as Record<string, unknown>
    expectMaskedString(out.refresh_token)
    expect(JSON.stringify(out)).not.toContain('rt_naver_xxx_yyy_zzz')
  })

  // ─── E3. 쿠팡 accessKey ─────────────────────────────
  it('E3: accessKey → 마스킹', () => {
    const out = maskRecord({ accessKey: 'aabbccdd-1122-3344-5566-77889900aabb' }) as Record<
      string,
      unknown
    >
    expectMaskedString(out.accessKey)
    expect(JSON.stringify(out)).not.toContain('aabbccdd-1122')
  })

  // ─── E4. 쿠팡 secretKey ─────────────────────────────
  it('E4: secretKey → 마스킹', () => {
    const out = maskRecord({ secretKey: 'SECRET_KEY_RAW_LEAK_FORBIDDEN' }) as Record<
      string,
      unknown
    >
    expectMaskedString(out.secretKey)
    expect(JSON.stringify(out)).not.toContain('SECRET_KEY_RAW_LEAK_FORBIDDEN')
  })

  // ─── E5. 쿠팡 vendorId ─────────────────────────────
  it('E5: vendorId → 마스킹', () => {
    const out = maskRecord({ vendorId: 'A00001234' }) as Record<string, unknown>
    expectMaskedString(out.vendorId)
    expect(JSON.stringify(out)).not.toContain('A00001234')
  })

  // ─── E6. ESM masterId ─────────────────────────────
  it('E6: masterId → 마스킹', () => {
    const out = maskRecord({ masterId: 'gmarket_seller_001' }) as Record<string, unknown>
    expectMaskedString(out.masterId)
    expect(JSON.stringify(out)).not.toContain('gmarket_seller_001')
  })

  // ─── E7. email PII ─────────────────────────────
  it('E7: email → 마스킹', () => {
    const out = maskRecord({ email: 'seller@example.com' }) as Record<string, unknown>
    expectMaskedString(out.email)
    expect(JSON.stringify(out)).not.toContain('seller@example.com')
  })

  // ─── E8. password ─────────────────────────────
  it('E8: password → 마스킹', () => {
    const out = maskRecord({ password: 'P@ssw0rd!' }) as Record<string, unknown>
    expectMaskedString(out.password)
    expect(JSON.stringify(out)).not.toContain('P@ssw0rd!')
  })

  // ─── E9. phone PII ─────────────────────────────
  it('E9: phone → 마스킹', () => {
    const out = maskRecord({ phone: '010-1234-5678' }) as Record<string, unknown>
    expectMaskedString(out.phone)
    expect(JSON.stringify(out)).not.toContain('010-1234-5678')
  })

  // ─── E10. 사업자등록번호 ─────────────────────────────
  it('E10: business_registration_number → 마스킹', () => {
    const out = maskRecord({ businessregistrationnumber: '123-45-67890' }) as Record<
      string,
      unknown
    >
    expectMaskedString(out.businessregistrationnumber)
    expect(JSON.stringify(out)).not.toContain('123-45-67890')
  })

  // ─── E11. Authorization 헤더 ─────────────────────────────
  it('E11: Authorization 헤더 → 마스킹', () => {
    const out = maskRecord({
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' },
    }) as { headers: Record<string, unknown> }
    expectMaskedString(out.headers.authorization)
    expect(JSON.stringify(out)).not.toContain('eyJhbGciOiJIUzI1NiJ9.payload.signature')
  })

  // ─── E11.b Bearer 패턴 — 키 이름이 아닌 값 안에 섞여 있어도 마스킹 ─────────────
  it('E11.b: 값 안의 Bearer 패턴 → 마스킹', () => {
    const out = maskRecord({ note: 'curl -H "Bearer abc.def.ghi" https://x' }) as Record<
      string,
      unknown
    >
    const s = String(out.note)
    expect(s).toContain('Bearer [REDACT:bearer:len=')
    expect(s).not.toContain('abc.def.ghi')
  })

  // ─── E12. OAuth code ─────────────────────────────
  it('E12: OAuth code / state / pkce_verifier → 마스킹', () => {
    const out = maskRecord({
      code: 'oauth_authcode_abc',
      state: 'csrf_state_xyz',
      pkce_verifier: 'pkce_xyz123',
    }) as Record<string, unknown>
    expectMaskedString(out.code)
    expectMaskedString(out.state)
    expectMaskedString(out.pkce_verifier)
    expect(JSON.stringify(out)).not.toContain('oauth_authcode_abc')
    expect(JSON.stringify(out)).not.toContain('csrf_state_xyz')
    expect(JSON.stringify(out)).not.toContain('pkce_xyz123')
  })

  // ─── E13. 중첩 객체 ─────────────────────────────
  it('E13: 중첩 객체 (data.credentials.accessKey) → 마스킹', () => {
    const out = maskRecord({
      data: {
        credentials: { accessKey: 'NESTED_AK_LEAK', vendorId: 'NESTED_VID' },
      },
    }) as { data: { credentials: Record<string, unknown> } }
    expectMaskedString(out.data.credentials.accessKey)
    expectMaskedString(out.data.credentials.vendorId)
    expect(JSON.stringify(out)).not.toContain('NESTED_AK_LEAK')
    expect(JSON.stringify(out)).not.toContain('NESTED_VID')
  })

  // ─── E14. 배열 안의 JWT ─────────────────────────────
  it('E14: 배열 안의 JWT → 마스킹', () => {
    const jwt1 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.sig1'
    const jwt2 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMiJ9.sig2'
    const out = maskRecord({ tokens: [jwt1, jwt2] }) as { tokens: unknown[] }
    expect(out.tokens).toHaveLength(2)
    expectMaskedString(out.tokens[0], { isJwt: true })
    expectMaskedString(out.tokens[1], { isJwt: true })
    expect(JSON.stringify(out)).not.toContain('eyJzdWIiOiJ1c2VyMSJ9')
    expect(JSON.stringify(out)).not.toContain('eyJzdWIiOiJ1c2VyMiJ9')
  })

  // ─── E15. sellerId UUID → 마스킹 안 함 ─────────────────────────────
  it('E15: sellerId (UUID) → 마스킹 안 함 (internal 식별자 보존)', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const out = maskRecord({ sellerId: uuid, seller_id: uuid }) as Record<string, unknown>
    expect(out.sellerId).toBe(uuid)
    expect(out.seller_id).toBe(uuid)
  })

  // ─── E16. encrypted_access_token (Edge 전용 ciphertext) ─────────────────────────────
  it('E16: encrypted_access_token / encryptedRefreshToken → 마스킹', () => {
    const out = maskRecord({
      encrypted_access_token: 'base64ciphertext_long_value',
      encryptedRefreshToken: 'base64ciphertext_refresh',
    }) as Record<string, unknown>
    expectMaskedString(out.encrypted_access_token)
    expectMaskedString(out.encryptedRefreshToken)
    expect(JSON.stringify(out)).not.toContain('base64ciphertext_long_value')
    expect(JSON.stringify(out)).not.toContain('base64ciphertext_refresh')
  })

  // ─── E17. master_key (pgcrypto 마스터 키) ─────────────────────────────
  it('E17: master_key / p_master_key → 마스킹', () => {
    const out = maskRecord({
      master_key: 'pgcrypto_master_secret_xxxxxxxxxxxxxxxx',
      p_master_key: 'rpc_param_master_secret',
    }) as Record<string, unknown>
    expectMaskedString(out.master_key)
    expectMaskedString(out.p_master_key)
    expect(JSON.stringify(out)).not.toContain('pgcrypto_master_secret_xxxxxxxxxxxxxxxx')
    expect(JSON.stringify(out)).not.toContain('rpc_param_master_secret')
  })

  // ─── E18. 깊이 초과 ─────────────────────────────
  it('E18: 깊이 6 초과 → [REDACT:depth]', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { leak: 'X' } } } } } } } }
    const out = maskRecord(deep)
    expect(JSON.stringify(out)).toContain('[REDACT:depth]')
  })

  // ─── 부가: null / 기본형 ─────────────────────────────
  it('null / undefined / primitive → 그대로 반환', () => {
    expect(maskRecord(null)).toBe(null)
    expect(maskRecord(undefined)).toBe(undefined)
    expect(maskRecord(42)).toBe(42)
    expect(maskRecord(true)).toBe(true)
  })
})

describe('maskError() — 에러 마스킹', () => {
  it('Error.message 에 토큰 섞여도 마스킹', () => {
    const err = new Error('failed Bearer eyJhbGciOiJIUzI1NiJ9.foo.bar at boundary')
    const out = maskError(err)
    expect(out.name).toBe('Error')
    const message = String(out.message)
    expect(message).not.toContain('eyJhbGciOiJIUzI1NiJ9.foo.bar')
  })

  it('MarketError-like context 의 access_token 도 마스킹', () => {
    class MarketLikeError extends Error {
      context: Record<string, unknown>
      code: string
      constructor(message: string, code: string, context: Record<string, unknown>) {
        super(message)
        this.name = 'MarketError'
        this.code = code
        this.context = context
      }
    }
    const err = new MarketLikeError('coupang fail', 'unauthorized', {
      access_token: 'eyJhbGc.payload.sig',
      vendorId: 'A00001234',
      sellerId: '550e8400-e29b-41d4-a716-446655440000',
    })
    const out = maskError(err)
    expect(out.name).toBe('MarketError')
    expect(out.code).toBe('unauthorized')
    const ctx = out.context as Record<string, unknown>
    expect(String(ctx.access_token)).toMatch(/^\[REDACT/)
    expect(String(ctx.vendorId)).toMatch(/^\[REDACT/)
    // sellerId 는 보존
    expect(ctx.sellerId).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('null / 비-Error → 안전 처리', () => {
    expect(maskError(null).name).toBe('unknown')
    expect(maskError('string-error').value).toContain('string-error')
  })
})
