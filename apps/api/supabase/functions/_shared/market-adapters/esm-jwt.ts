/**
 * ESM 2.0 (G마켓·옥션) JWT HS256 서명 모듈 (Edge Function / Deno 측).
 *
 * 알고리즘은 프론트엔드 미러와 동일:
 *   apps/web/src/lib/markets/real/esm/jwt.ts
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (ESM JWT)
 *   - WIP-5markets-mvp.md C-3 Phase 0
 *
 * JWT 스펙:
 *   header  = { alg: 'HS256', typ: 'JWT', kid: '{MasterID}' }
 *   payload = { iss: 'esm', sub: 'sell', aud: 'sa.esmplus.com',
 *               iat, exp: iat+300, site: 'G'|'A' }
 *   signature = HMAC-SHA256(secretKey, base64url(header) + '.' + base64url(payload))
 *
 * Deno 환경: Web Crypto API (`crypto.subtle`) 기본 제공 — Node.js crypto 사용 불가.
 * 순수 함수 — 부작용 없음 (Math.random / Date.now 외).
 */

export interface EsmJwtInput {
  masterId: string
  secretKey: string
  site: 'G' | 'A'
  iat?: number
  ttlSec?: number
}

export interface EsmJwtResult {
  token: string
  exp: number
}

const DEFAULT_TTL_SEC = 300

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

/**
 * ESM Selling API JWT (HS256) 발급.
 * masterId / secretKey 는 절대 로그 포함 금지 (호출측 책임).
 */
export async function buildEsmJwt(input: EsmJwtInput): Promise<EsmJwtResult> {
  const {
    masterId,
    secretKey,
    site,
    iat = Math.floor(Date.now() / 1000),
    ttlSec = DEFAULT_TTL_SEC,
  } = input

  const exp = iat + ttlSec

  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: masterId,
  }
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
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(signingInput),
  )
  const signatureB64 = bytesToBase64Url(new Uint8Array(signatureBuffer))

  const token = `${signingInput}.${signatureB64}`
  return { token, exp }
}
