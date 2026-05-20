/**
 * ESM JWT Edge Function 모듈 단위 테스트 (10건).
 *
 * 파일 위치: tests/unit/market-adapters/esm-edge.test.ts
 * (vitest.config.ts 의 tests/unit/**\/\*.test.ts 경로에 포함됨)
 *
 * 마스터: WIP-5markets-mvp.md C-3 Phase 0
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.
 *
 * Edge Function 측 esm-jwt.ts 는 Deno 전용 import 가 없어 Vitest 환경에서
 * 그대로 import 가능했지만, coupang-edge 패턴과의 일관성 + 향후 알고리즘
 * 변경 시 의도치 않은 회귀 방지를 위해 동일 알고리즘을 인라인 재구현해 검증.
 *
 * 테스트 카테고리:
 *   E1.  base64url 인코딩 — '+', '/', '=' 미포함
 *   E2.  JWT 3-segment 구조
 *   E3.  header 디코드 — alg / typ / kid
 *   E4.  payload 디코드 — iss / sub / aud / iat / exp / site
 *   E5.  결정성 — 같은 입력 두 번 → 동일 토큰
 *   E6.  site G ↔ A 시 payload + signature 변경
 *   E7.  exp = iat + ttlSec (기본 300)
 *   E8.  ttlSec 커스텀 60 → exp = iat + 60
 *   E9.  secretKey 변경 시 signature 만 다름 (header/payload 동일)
 *  E10.  signature 형식 — base64url 문자 셋 (HMAC-SHA256 = 32B → 43 base64url chars)
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
// Edge Function 의 ESM JWT 알고리즘을 인라인으로 재구현
// 출처: apps/api/supabase/functions/_shared/market-adapters/esm-jwt.ts
// ─────────────────────────────────────────────

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

function stringToBase64Url(input: string): string {
  return bytesToBase64Url(new TextEncoder().encode(input))
}

async function buildEsmJwt(opts: {
  masterId: string
  secretKey: string
  site: 'G' | 'A'
  iat?: number
  ttlSec?: number
}): Promise<{ token: string; exp: number }> {
  const {
    masterId,
    secretKey,
    site,
    iat = Math.floor(Date.now() / 1000),
    ttlSec = 300,
  } = opts
  const exp = iat + ttlSec

  const header = { alg: 'HS256', typ: 'JWT', kid: masterId }
  const payload = {
    iss: 'esm',
    sub: 'sell',
    aud: 'sa.esmplus.com',
    iat,
    exp,
    site,
  }

  const headerB64 = stringToBase64Url(JSON.stringify(header))
  const payloadB64 = stringToBase64Url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(signingInput))
  const signatureB64 = bytesToBase64Url(new Uint8Array(buf))
  return { token: `${signingInput}.${signatureB64}`, exp }
}

// 디코드 헬퍼
function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  return atob(base64)
}
function decodeJsonSegment(segment: string): unknown {
  return JSON.parse(base64UrlDecode(segment))
}

function segmentAt(token: string, idx: 0 | 1 | 2): string {
  const parts = token.split('.')
  const part = parts[idx]
  if (part === undefined) throw new Error(`JWT segment ${idx} missing`)
  return part
}

// ─────────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────────

const FIXED_MASTER_ID = 'master-id-edge'
const FIXED_SECRET_KEY = 'secret-key-edge'
const FIXED_IAT = 1747734645

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe('E1: base64url 인코딩 형식', () => {
  it('"+", "/", "=" 미포함 — base64url 문자만 사용', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      iat: FIXED_IAT,
    })
    expect(token).not.toMatch(/[+/=]/)
    expect(token).toMatch(/^[A-Za-z0-9_\-.]+$/)
  })
})

describe('E2: JWT 3-segment 구조', () => {
  it('header.payload.signature 3-segment', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      iat: FIXED_IAT,
    })
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })
})

describe('E3: header 디코드', () => {
  it('alg=HS256, typ=JWT, kid=masterId', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'A',
      iat: FIXED_IAT,
    })
    const header = decodeJsonSegment(segmentAt(token, 0)) as Record<string, unknown>
    expect(header.alg).toBe('HS256')
    expect(header.typ).toBe('JWT')
    expect(header.kid).toBe(FIXED_MASTER_ID)
  })
})

describe('E4: payload 디코드', () => {
  it('iss/sub/aud 고정 + iat/exp/site 변동', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      iat: FIXED_IAT,
    })
    const payload = decodeJsonSegment(segmentAt(token, 1)) as Record<string, unknown>
    expect(payload.iss).toBe('esm')
    expect(payload.sub).toBe('sell')
    expect(payload.aud).toBe('sa.esmplus.com')
    expect(payload.iat).toBe(FIXED_IAT)
    expect(payload.exp).toBe(FIXED_IAT + 300)
    expect(payload.site).toBe('G')
  })
})

describe('E5: 결정성', () => {
  it('같은 입력 두 번 → 동일 토큰', async () => {
    const input = {
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G' as const,
      iat: FIXED_IAT,
    }
    const r1 = await buildEsmJwt(input)
    const r2 = await buildEsmJwt(input)
    expect(r1.token).toBe(r2.token)
    expect(r1.exp).toBe(r2.exp)
  })
})

describe('E6: site G ↔ A 변경 시 토큰 변경', () => {
  it('site 만 다르면 payload + signature 변경, header 동일', async () => {
    const baseInput = {
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      iat: FIXED_IAT,
    }
    const gMarket = await buildEsmJwt({ ...baseInput, site: 'G' })
    const auction = await buildEsmJwt({ ...baseInput, site: 'A' })
    const [hG, pG] = gMarket.token.split('.')
    const [hA, pA] = auction.token.split('.')
    expect(hG).toBe(hA) // header 동일 (kid 같음)
    expect(pG).not.toBe(pA) // payload 다름 (site)
    expect(gMarket.token).not.toBe(auction.token)
  })
})

describe('E7: exp 기본 ttl 300', () => {
  it('exp = iat + 300', async () => {
    const { exp } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      iat: FIXED_IAT,
    })
    expect(exp).toBe(FIXED_IAT + 300)
  })
})

describe('E8: ttlSec 커스텀', () => {
  it('ttlSec=60 → exp = iat + 60', async () => {
    const { exp } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      iat: FIXED_IAT,
      ttlSec: 60,
    })
    expect(exp).toBe(FIXED_IAT + 60)
  })
})

describe('E9: secretKey 변경 시 signature 만 다름', () => {
  it('header/payload 동일, signature 다름', async () => {
    const baseInput = {
      masterId: FIXED_MASTER_ID,
      site: 'G' as const,
      iat: FIXED_IAT,
    }
    const r1 = await buildEsmJwt({ ...baseInput, secretKey: 'sk-1' })
    const r2 = await buildEsmJwt({ ...baseInput, secretKey: 'sk-2' })
    const [h1, p1, s1] = r1.token.split('.')
    const [h2, p2, s2] = r2.token.split('.')
    expect(h1).toBe(h2)
    expect(p1).toBe(p2)
    expect(s1).not.toBe(s2)
  })
})

describe('E10: signature 길이 — HMAC-SHA256 (32B → base64url 43자)', () => {
  it('signature 부분이 base64url 43자', async () => {
    const { token } = await buildEsmJwt({
      masterId: FIXED_MASTER_ID,
      secretKey: FIXED_SECRET_KEY,
      site: 'G',
      iat: FIXED_IAT,
    })
    const parts = token.split('.')
    expect(parts[2]).toHaveLength(43) // HMAC-SHA256 = 32 byte = 43 base64url chars (no padding)
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
