/**
 * ESM 2.0 (G마켓·옥션) JWT HS256 서명 모듈 (프론트엔드 / Vite 환경).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (ESM JWT)
 *   - WIP-5markets-mvp.md C-3 Phase 0
 *
 * JWT 스펙 (ESM Selling API — esm-api/README.md 인증 섹션):
 *   header  = { alg: 'HS256', typ: 'JWT', kid: '{ESM+ Master ID}' }
 *   payload = {
 *     iss:  '{token issuer}',       // 토큰 발행자 (클라이언트 도메인). 기본 'www.esmplus.com'
 *     sub:  'sell',                 // Sell API 고정
 *     aud:  'sa.esmplus.com',       // 고정
 *     iat:  <epoch seconds>,
 *     exp:  <iat + 300>,            // 5분 짧은 수명 — 매 요청마다 새로 발급
 *     ssi:  '{siteId}:{sellerId}',  // 옥션 'A:<sellerId>' / 지마켓 'G:<sellerId>'
 *   }                               //   사이트별 분리이므로 단일 사이트만 (콤마 결합 안 함)
 *   signature = HMAC-SHA256(secretKey, base64url(header) + '.' + base64url(payload))
 *
 * 구현 원칙:
 *   - Web Crypto API (`crypto.subtle`) 사용 — Vite/브라우저 + Deno 양쪽 호환.
 *   - Node `crypto` 모듈 / npm `jose` 등 의존 금지 (번들 부담 + Deno 비호환).
 *   - `masterId` / `secretKey` 는 절대 로그에 포함하지 않는다 (호출측 책임).
 *   - 토큰 수명이 5분으로 짧으므로 캐시 없이 매 호출 시 발급.
 */

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

/** buildEsmJwt 입력 */
export interface EsmJwtInput {
  /** ESM+ Master ID (header.kid 로 사용) */
  masterId: string
  /** ESM+ Secret Key (HMAC-SHA256 서명 키) */
  secretKey: string
  /** 마켓 분기 — 'G' = G마켓, 'A' = 옥션 (payload.ssi 의 siteId) */
  site: 'G' | 'A'
  /** 사이트 판매자 ID (payload.ssi 의 sellerId — 우리 schema 의 sellerId 필드) */
  sellerId: string
  /**
   * 토큰 발행자 (payload.iss). 클라이언트 도메인. 생략 시 'www.esmplus.com'.
   */
  iss?: string
  /**
   * 발급 기준 시각 (epoch seconds). 생략 시 `Math.floor(Date.now()/1000)`.
   * 단위 테스트에서 결정성 보장을 위해 고정값 주입 가능.
   */
  iat?: number
  /**
   * 토큰 수명(초). 기본 300 (=5분). ESM Selling API 권장 수명.
   */
  ttlSec?: number
}

/** buildEsmJwt 반환 */
export interface EsmJwtResult {
  /** Bearer 헤더에 그대로 사용 가능한 JWT 문자열 (header.payload.signature) */
  token: string
  /** 토큰 만료 epoch seconds */
  exp: number
}

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const DEFAULT_TTL_SEC = 300
const DEFAULT_ISS = 'www.esmplus.com'

// ─────────────────────────────────────────────
// base64url 인코딩
// ─────────────────────────────────────────────

/**
 * Uint8Array → base64url 문자열.
 * `+` → `-`, `/` → `_`, trailing `=` 제거.
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  // ArrayBuffer → binary string (각 바이트가 0~255 의 char code)
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  // btoa 는 binary string → base64 (Vite 브라우저 + Deno globalThis 모두 지원)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

/** UTF-8 문자열 → base64url. */
function stringToBase64Url(input: string): string {
  return bytesToBase64Url(new TextEncoder().encode(input))
}

// ─────────────────────────────────────────────
// JWT 서명
// ─────────────────────────────────────────────

/**
 * ESM Selling API JWT (HS256) 발급.
 *
 * Web Crypto API 사용 — async.
 * 토큰·비밀키는 반환값에 포함하지 않는다 (서명된 JWT 와 exp 만).
 *
 * @throws Error — Web Crypto 미지원 환경 (구형 브라우저 / test runner mock 누락 시)
 */
export async function buildEsmJwt(input: EsmJwtInput): Promise<EsmJwtResult> {
  const {
    masterId,
    secretKey,
    site,
    sellerId,
    iss = DEFAULT_ISS,
    iat = Math.floor(Date.now() / 1000),
    ttlSec = DEFAULT_TTL_SEC,
  } = input

  const exp = iat + ttlSec

  // header
  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: masterId,
  }
  // payload — ssi 는 사이트별 분리이므로 단일 사이트만 ('{site}:{sellerId}').
  const payload = {
    iss,
    sub: 'sell',
    aud: 'sa.esmplus.com',
    iat,
    exp,
    ssi: `${site}:${sellerId}`,
  }

  // JSON.stringify 는 키 순서가 객체 리터럴 정의 순서와 일치 (ES2015+).
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
