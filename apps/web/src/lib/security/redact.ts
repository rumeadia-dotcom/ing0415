/**
 * 마스킹 유틸 — 프론트엔드 / Edge Function 공용 패턴.
 *
 * 마스터: docs/architecture/v1/security.md §6.1 (금지 키 화이트리스트) / §6.2 (redact 구현).
 *
 * 강제 (security 거부권):
 * - Sentry beforeSend / beforeBreadcrumb 에서 본 함수 통과 의무.
 * - 키 추가 시 security.md §6.1 화이트리스트도 동기화하는 PR 동반.
 * - looksLikeJwt 정규식은 JWT 3분절 패턴만. 단순 길이 기반 마스킹은 false positive 가 많아 제외.
 */

// security.md §6.1 + §6.2 화이트리스트 — 소문자 키만 비교. snake_case / camelCase 모두 커버.
const REDACT_KEYS: ReadonlySet<string> = new Set([
  // OAuth / 인증 토큰
  'access_token',
  'refresh_token',
  'id_token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  // API 키 / 시크릿
  'apikey',
  'api_key',
  'secret',
  'client_secret',
  'clientsecret',
  // 마켓별 자격증명 (D-D 회귀 — 쿠팡 HMAC / ESM JWT 등 camelCase 필드)
  'accesskey',
  'access_key',
  'secretkey',
  'secret_key',
  'vendorid',
  'vendor_id',
  'masterid',
  'master_id',
  // 비밀번호
  'password',
  'passwordconfirm',
  'password_confirm',
  // PII
  'email',
  'phone',
  'phonenumber',
  'phone_number',
  'name',
  'fullname',
  'full_name',
  'realname',
  'real_name',
  // 사업자·금융
  'businessnumber',
  'business_number',
  'businessregistrationnumber',
  'business_registration_number',
  'bankaccount',
  'bank_account',
  'accountnumber',
  'account_number',
  // HTTP 헤더
  'authorization',
  'cookie',
  'set-cookie',
  // Market Gateway HMAC 헤더 (cross-cutting/market-gateway.md)
  // x-gw-sig 자체는 HMAC 결과 (재현 불가) 이지만, x-gw-ts 와 함께 노출되면 replay 공격
  // 표면이 약간 늘어남. 운영 로그 정책상 둘 다 마스킹.
  'x-gw-sig',
  'x-gw-ts',
  'xgwsig',
  'xgwts',
  // OAuth 콜백 (D-D 회귀 — code 는 10분짜리지만 복원 시 토큰 발급 가능)
  'code',
  'state',
  'pkce_verifier',
  'pkceverifier',
])

const JWT_PATTERN = /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

const looksLikeJwt = (value: string): boolean => JWT_PATTERN.test(value)

const MAX_DEPTH = 6

/**
 * 객체 / 배열 / 문자열을 재귀 순회하며 금지 키 + JWT 형 문자열을 마스킹.
 *
 * - 키 매칭: 소문자 비교. 객체 값이 string 이면 `[REDACT:<key>:len=N]`, 그 외 `[REDACT]`.
 * - JWT 형 문자열: 키와 무관하게 `[REDACT:jwt:len=N]`.
 * - 깊이 초과: `[REDACT:depth]`.
 * - 원본 객체는 변경하지 않음 (Sentry event 재사용 안전).
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[REDACT:depth]'
  if (value === null || value === undefined) return value

  if (typeof value === 'string') {
    if (looksLikeJwt(value)) return `[REDACT:jwt:len=${value.length}]`
    return value
  }

  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1))
  }

  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(source)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      if (typeof raw === 'string') {
        out[key] = `[REDACT:${key}:len=${raw.length}]`
      } else {
        out[key] = '[REDACT]'
      }
      continue
    }
    out[key] = redact(raw, depth + 1)
  }
  return out
}
