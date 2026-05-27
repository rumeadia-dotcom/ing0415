/**
 * 쿠팡 Wing OpenAPI HMAC-SHA256 서명 모듈.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (쿠팡 HMAC)
 *   - WIP-5markets-mvp.md C-2
 *
 * 서명 방식 (Wing OpenAPI 공식 — "Creating HMAC Signature"):
 *   message   = datetime + method + path + query   (무개행 연결, query 없으면 "")
 *   signature = HMAC-SHA256(secretKey, message) → hex lowercase
 *   Authorization: "CEA algorithm=HmacSHA256, access-key={accessKey},
 *                   signed-date={datetime}, signature={signature}"
 *
 *   datetime format: "YYMMDD'T'HHmmss'Z'" (UTC, 예: "260520T093045Z")
 *
 * 구현 원칙:
 *   - 순수 함수. Math.random / Date / 부작용 없음.
 *   - Web Crypto API (`crypto.subtle`) 사용 — Vite/브라우저 + Deno 양쪽 호환.
 *   - Node.js `crypto` 모듈 import 금지 (브라우저 빌드 불가).
 *   - accessKey / secretKey 는 절대 로그에 포함하지 않는다 (호출측 책임).
 */

/** buildCoupangSignature 에 필요한 입력 */
export interface CoupangSignatureInput {
  /** HTTP 메서드 (대소문자 무관, 내부에서 대문자 정규화). */
  method: string
  /** 요청 path + query string. 예: "/v2/providers/.../categorization/...". */
  path: string
  /** Wing OpenAPI 발급 accessKey */
  accessKey: string
  /** Wing OpenAPI 발급 secretKey */
  secretKey: string
  /**
   * 서명 기준 시각 (ISO 8601). 생략 시 현재 UTC.
   * 단위 테스트에서 결정성 보장을 위해 고정값 주입 가능.
   */
  now?: Date
}

/** buildCoupangSignature 반환 */
export interface CoupangSignatureResult {
  /** "YYMMDD'T'HHmmss'Z'" 형식 UTC 문자열. 예: "260520T093045Z" */
  datetime: string
  /** HMAC-SHA256 hex lowercase */
  signature: string
  /** Authorization 헤더 전체 값 */
  authorization: string
}

/**
 * UTC Date → 쿠팡 Wing OpenAPI 날짜 포맷 "YYMMDDTHHmmssZ".
 * 예: 2026-05-20 09:30:45 UTC → "260520T093045Z"
 */
export function formatCoupangDatetime(date: Date): string {
  const pad2 = (n: number): string => String(n).padStart(2, '0')
  const year = String(date.getUTCFullYear()).slice(-2) // 마지막 2자리
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const hour = pad2(date.getUTCHours())
  const min = pad2(date.getUTCMinutes())
  const sec = pad2(date.getUTCSeconds())
  return `${year}${month}${day}T${hour}${min}${sec}Z`
}

/**
 * 쿠팡 Wing OpenAPI HMAC-SHA256 서명 생성.
 *
 * Web Crypto API 사용 — async.
 * 토큰·비밀키는 반환값에 포함하지 않는다 (signature 와 authorization 만 반환).
 *
 * @throws Error — Web Crypto 미지원 환경 (구형 브라우저 / test runner mock 누락 시)
 */
export async function buildCoupangSignature(
  input: CoupangSignatureInput,
): Promise<CoupangSignatureResult> {
  const { method, path, accessKey, secretKey, now = new Date() } = input

  const datetime = formatCoupangDatetime(now)
  // 메서드는 대문자로 정규화
  const upperMethod = method.toUpperCase()

  // Coupang 공식 스펙: message = datetime + method + path + query (무개행 연결).
  // path 에 query 가 붙어 오면 '?' 를 떼고 path / query 로 분리해 연결한다.
  const qIdx = path.indexOf('?')
  const pathOnly = qIdx === -1 ? path : path.slice(0, qIdx)
  const query = qIdx === -1 ? '' : path.slice(qIdx + 1)
  const message = `${datetime}${upperMethod}${pathOnly}${query}`

  // Web Crypto HMAC-SHA256
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

  // hex lowercase 변환
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`

  return { datetime, signature, authorization }
}
