/**
 * Sentry PII 마스킹 회귀 테스트 — 프론트엔드 (`apps/web/src/lib/security/redact.ts`).
 *
 * 출처 / 근거:
 *   - 작업 카드: D-D (WIP-5markets-mvp.md Phase 4 — Sentry 마스킹 운영환경 검증)
 *   - 마스터: docs/architecture/v1/security.md §6.1 (금지 키 화이트리스트) / §6.2 (redact 구현)
 *   - CLAUDE.md "외부 API 로깅 패턴" — OAuth 토큰 / API 키 / PII 절대 금지
 *
 * 목적:
 *   `redact()` 가 운영에서 발생할 수 있는 모든 마스킹 대상 (15+ 시나리오) 을
 *   회귀 단위로 잠근다. 키가 추가/삭제되면 본 테스트가 우선 실패한다.
 *
 * 시나리오 매트릭스 (15건):
 *   R1.  OAuth access_token (JWT 형)
 *   R2.  OAuth refresh_token
 *   R3.  쿠팡 accessKey (HMAC)
 *   R4.  쿠팡 secretKey (HMAC)
 *   R5.  쿠팡 vendorId (자격증명 일부)
 *   R6.  ESM masterId (G마켓/옥션 통합 셀러 ID)
 *   R7.  email (셀러 PII)
 *   R8.  password (셀러 로그인)
 *   R9.  phone (셀러 PII)
 *   R10. 사업자등록번호 (business_registration_number)
 *   R11. Authorization 헤더
 *   R12. URL query 의 OAuth code
 *   R13. 중첩 객체 (data.credentials.accessKey)
 *   R14. 배열 안의 토큰
 *   R15. sellerId (UUID, internal — 마스킹 안 됨이 정상)
 *
 * 주의:
 *   redact 는 키 이름 매칭 + JWT 패턴만 본다. JWT 형이 아닌 임의 토큰 문자열은
 *   키 이름에 의존하므로, 마켓별 자격증명 키 (accessKey / secretKey / vendorId / masterId)
 *   가 redact 화이트리스트에 포함되어 있어야 한다.
 */

import { describe, it, expect } from 'vitest'

import { redact } from '../redact'

/** 마스킹된 출력이 `[REDACT:...]` 패턴인지 검증 — 단일 진입점 */
function expectMasked(out: unknown, opts?: { keyHint?: string; isJwt?: boolean }): void {
  expect(typeof out).toBe('string')
  const s = out as string
  expect(s.startsWith('[REDACT')).toBe(true)
  if (opts?.isJwt) {
    expect(s).toMatch(/^\[REDACT:jwt:len=\d+\]$/)
  }
  if (opts?.keyHint) {
    expect(s.toLowerCase()).toContain(opts.keyHint.toLowerCase())
  }
}

describe('redact() — Sentry PII 마스킹 회귀 (D-D Phase 4)', () => {
  // ─── R1. OAuth access_token (JWT 형) ─────────────────────────────
  it('R1: OAuth access_token (JWT 형) → 마스킹', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signature'
    const out = redact({ access_token: jwt }) as Record<string, unknown>
    expectMasked(out.access_token, { keyHint: 'access_token' })
    // 원본 토큰이 그대로 노출되어서는 안 된다
    expect(JSON.stringify(out)).not.toContain('eyJzdWIi')
  })

  // ─── R2. refresh_token ─────────────────────────────
  it('R2: refresh_token 평문 문자열 → 마스킹', () => {
    const out = redact({ refresh_token: 'rt_secret_xxx_yyy_zzz' }) as Record<string, unknown>
    expectMasked(out.refresh_token, { keyHint: 'refresh_token' })
    expect(JSON.stringify(out)).not.toContain('rt_secret_xxx_yyy_zzz')
  })

  // ─── R3. 쿠팡 accessKey ─────────────────────────────
  it('R3: 쿠팡 accessKey (HMAC) → 마스킹', () => {
    const out = redact({ accessKey: 'aabbccdd-1122-3344-5566-77889900aabb' }) as Record<
      string,
      unknown
    >
    expectMasked(out.accessKey)
    expect(JSON.stringify(out)).not.toContain('aabbccdd-1122')
  })

  // ─── R4. 쿠팡 secretKey ─────────────────────────────
  it('R4: 쿠팡 secretKey (HMAC) → 마스킹', () => {
    const out = redact({ secretKey: 'SECRET_KEY_RAW_VALUE_DO_NOT_LEAK' }) as Record<
      string,
      unknown
    >
    expectMasked(out.secretKey)
    expect(JSON.stringify(out)).not.toContain('SECRET_KEY_RAW_VALUE')
  })

  // ─── R5. 쿠팡 vendorId ─────────────────────────────
  it('R5: 쿠팡 vendorId (자격증명 일부) → 마스킹', () => {
    const out = redact({ vendorId: 'A00001234' }) as Record<string, unknown>
    expectMasked(out.vendorId)
    expect(JSON.stringify(out)).not.toContain('A00001234')
  })

  // ─── R6. ESM masterId (G마켓/옥션 통합 셀러 ID) ─────────────────────────────
  it('R6: ESM masterId → 마스킹', () => {
    const out = redact({ masterId: 'gmarket_seller_001' }) as Record<string, unknown>
    expectMasked(out.masterId)
    expect(JSON.stringify(out)).not.toContain('gmarket_seller_001')
  })

  // ─── R7. email PII ─────────────────────────────
  it('R7: email PII → 마스킹', () => {
    const out = redact({ email: 'seller@example.com' }) as Record<string, unknown>
    expectMasked(out.email, { keyHint: 'email' })
    expect(JSON.stringify(out)).not.toContain('seller@example.com')
  })

  // ─── R8. password ─────────────────────────────
  it('R8: password → 마스킹', () => {
    const out = redact({ password: 'P@ssw0rd!' }) as Record<string, unknown>
    expectMasked(out.password, { keyHint: 'password' })
    expect(JSON.stringify(out)).not.toContain('P@ssw0rd!')
  })

  // ─── R9. phone PII ─────────────────────────────
  it('R9: phone PII → 마스킹', () => {
    const out = redact({ phone: '010-1234-5678' }) as Record<string, unknown>
    expectMasked(out.phone, { keyHint: 'phone' })
    expect(JSON.stringify(out)).not.toContain('010-1234-5678')
  })

  // ─── R10. 사업자등록번호 ─────────────────────────────
  it('R10: business_registration_number → 마스킹', () => {
    const out = redact({ business_registration_number: '123-45-67890' }) as Record<
      string,
      unknown
    >
    expectMasked(out.business_registration_number, { keyHint: 'business_registration_number' })
    expect(JSON.stringify(out)).not.toContain('123-45-67890')
  })

  // ─── R11. Authorization 헤더 ─────────────────────────────
  it('R11: Authorization 헤더 (Bearer xxx) → 마스킹', () => {
    const out = redact({
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' },
    }) as { headers: Record<string, unknown> }
    expectMasked(out.headers.Authorization, { keyHint: 'authorization' })
    // 토큰 본문 노출 차단
    expect(JSON.stringify(out)).not.toContain('eyJhbGciOiJIUzI1NiJ9.payload.signature')
  })

  // ─── R12. URL query 의 OAuth code ─────────────────────────────
  it('R12: URL query 의 OAuth code → 마스킹', () => {
    // OAuth 콜백 본문 가정: { code, state }
    const out = redact({ code: 'oauth_authcode_abc123xyz', state: 'csrf_state_xyz' }) as Record<
      string,
      unknown
    >
    expectMasked(out.code)
    expectMasked(out.state)
    expect(JSON.stringify(out)).not.toContain('oauth_authcode_abc123xyz')
    expect(JSON.stringify(out)).not.toContain('csrf_state_xyz')
  })

  // ─── R13. 중첩 객체 (data.credentials.accessKey) ─────────────────────────────
  it('R13: 중첩 객체 (data.credentials.accessKey) → 마스킹', () => {
    const out = redact({
      data: {
        credentials: {
          accessKey: 'NESTED_ACCESS_KEY_LEAK',
          vendorId: 'NESTED_VENDOR_ID',
        },
      },
    }) as { data: { credentials: Record<string, unknown> } }
    expectMasked(out.data.credentials.accessKey)
    expectMasked(out.data.credentials.vendorId)
    expect(JSON.stringify(out)).not.toContain('NESTED_ACCESS_KEY_LEAK')
    expect(JSON.stringify(out)).not.toContain('NESTED_VENDOR_ID')
  })

  // ─── R14. 배열 안의 토큰 ─────────────────────────────
  it('R14: 배열 안의 JWT 형 토큰 → 마스킹', () => {
    const jwt1 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.sig1'
    const jwt2 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMiJ9.sig2'
    const out = redact({ tokens: [jwt1, jwt2] }) as { tokens: unknown[] }
    expect(Array.isArray(out.tokens)).toBe(true)
    expect(out.tokens).toHaveLength(2)
    expectMasked(out.tokens[0], { isJwt: true })
    expectMasked(out.tokens[1], { isJwt: true })
    expect(JSON.stringify(out)).not.toContain('eyJzdWIiOiJ1c2VyMSJ9')
    expect(JSON.stringify(out)).not.toContain('eyJzdWIiOiJ1c2VyMiJ9')
  })

  // ─── R15. sellerId UUID — 마스킹 안 함 (internal 식별자 보존) ─────────────────────────────
  it('R15: sellerId (UUID) → 마스킹 안 함 (internal 식별자)', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const out = redact({ sellerId: uuid, seller_id: uuid }) as Record<string, unknown>
    // 운영 진단을 위해 internal sellerId 는 그대로 보존되어야 한다 (CLAUDE.md 규약)
    expect(out.sellerId).toBe(uuid)
    expect(out.seller_id).toBe(uuid)
  })

  // ─── 부가: 원본 미변경 (immutability) — Sentry event 재사용 안전 검증 ─────────────
  it('원본 객체 미변경 — Sentry event 재사용 안전', () => {
    const input = { access_token: 'eyJhbGciOiJIUzI1NiJ9.abc.def', name: 'Alice' }
    const snapshot = JSON.stringify(input)
    redact(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  // ─── 부가: 깊이 초과 가드 ─────────────
  it('깊이 6 초과 → [REDACT:depth]', () => {
    // 7단 중첩 객체
    const deep = { a: { b: { c: { d: { e: { f: { g: { leak: 'X' } } } } } } } }
    const out = redact(deep)
    expect(JSON.stringify(out)).toContain('[REDACT:depth]')
  })

  // ─── 부가: null / undefined / primitive 안전 ─────────────
  it('null / undefined / primitive 전달 안전', () => {
    expect(redact(null)).toBe(null)
    expect(redact(undefined)).toBe(undefined)
    expect(redact(42)).toBe(42)
    expect(redact(true)).toBe(true)
    expect(redact('just text')).toBe('just text')
  })
})
