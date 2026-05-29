/**
 * 쿠팡 Wing OpenAPI HMAC-SHA256 서명 모듈 (Edge Function / Deno 측).
 *
 * 알고리즘은 프론트엔드 미러와 동일:
 *   apps/web/src/lib/markets/real/coupang/hmac.ts
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (쿠팡 HMAC)
 *   - WIP-5markets-mvp.md C-2 Phase 2
 *
 * 서명 방식 (Coupang 공식 — developers.coupangcorp.com "Creating HMAC Signature"):
 *   message   = datetime + METHOD + path + query   (무개행 연결, query 없으면 "")
 *   signature = HMAC-SHA256(secretKey, message) → hex lowercase
 *   Authorization: "CEA algorithm=HmacSHA256, access-key={accessKey},
 *                   signed-date={datetime}, signature={signature}"
 *   datetime format: "YYMMDDTHHmmssZ" (UTC)
 *
 * Deno 환경: Web Crypto API (`crypto.subtle`) 기본 제공 — Node.js crypto 사용 불가.
 * 순수 함수 — 부작용 없음.
 */

export interface CoupangSignatureInput {
  method: string
  path: string
  accessKey: string
  secretKey: string
  now?: Date
}

export interface CoupangSignatureResult {
  datetime: string
  signature: string
  authorization: string
}

/**
 * UTC Date → 쿠팡 datetime 포맷 "YYMMDDTHHmmssZ".
 * 예: 2026-05-20 09:30:45 UTC → "260520T093045Z"
 */
export function formatCoupangDatetime(date: Date): string {
  const pad2 = (n: number): string => String(n).padStart(2, '0')
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const hour = pad2(date.getUTCHours())
  const min = pad2(date.getUTCMinutes())
  const sec = pad2(date.getUTCSeconds())
  return `${year}${month}${day}T${hour}${min}${sec}Z`
}

/**
 * HMAC-SHA256 서명 생성 (async, Web Crypto API).
 * accessKey / secretKey 는 절대 로그 포함 금지 (호출측 책임).
 */
export async function buildCoupangSignature(
  input: CoupangSignatureInput,
): Promise<CoupangSignatureResult> {
  const { method, path, accessKey, secretKey, now = new Date() } = input
  const datetime = formatCoupangDatetime(now)
  const upperMethod = method.toUpperCase()
  // Coupang 공식 스펙: message = datetime + method + path + query (무개행 연결).
  // path 에 query 가 붙어 오면 '?' 를 떼고 path / query 로 분리해 연결한다.
  const qIdx = path.indexOf('?')
  const pathOnly = qIdx === -1 ? path : path.slice(0, qIdx)
  const query = qIdx === -1 ? '' : path.slice(qIdx + 1)
  const message = `${datetime}${upperMethod}${pathOnly}${query}`

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
    encoder.encode(message),
  )
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`

  return { datetime, signature, authorization }
}
