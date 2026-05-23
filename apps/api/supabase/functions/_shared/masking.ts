/**
 * 로그 / Sentry / 응답 본문 마스킹.
 *
 * 마스터: docs/architecture/v1/security.md §6.1 / §6.2
 *         docs/architecture/v1/cross-cutting/credential-vault.md §7.1
 *
 * 강제:
 *   - 본 모듈을 통과하지 않은 객체는 외부로 송출 금지 (logger / Sentry / response).
 *   - 키 이름은 lower-case 비교. snake_case / camelCase / PascalCase 모두 동일 마스킹.
 *   - JWT 형태 (eyJ... 3-segment) 의 값은 키 이름과 무관하게 자동 마스킹.
 *   - 토큰·시크릿·PII는 길이만 노출 (`[REDACT:<key>:len=<n>]`).
 *
 * 본 모듈은 외부 의존 없음 (Deno 표준).
 */

/** 마스킹 대상 키 화이트리스트 (lower-case). security.md §6.1 단일 출처. */
const REDACT_KEYS: ReadonlySet<string> = new Set([
  // OAuth / 인증 토큰
  'access_token',
  'refresh_token',
  'id_token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  // ciphertext 도 키 유출 시 복호 가능하므로 차단 (credential-vault.md §7.1)
  'encrypted_access_token',
  'encrypted_refresh_token',
  'encryptedaccesstoken',
  'encryptedrefreshtoken',
  // API 키 / 시크릿
  'apikey',
  'api_key',
  'secret',
  'client_secret',
  'clientsecret',
  // 마켓별 자격증명 (D-D 회귀 — 쿠팡 HMAC / ESM JWT camelCase 필드)
  'accesskey',
  'access_key',
  'secretkey',
  'secret_key',
  'vendorid',
  'vendor_id',
  'masterid',
  'master_id',
  // pgcrypto 마스터 키
  'master_key',
  'masterkey',
  'p_master_key',
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
  'businessnumber',
  'business_number',
  'businessregistrationnumber',
  'bankaccount',
  'bank_account',
  'accountnumber',
  'account_number',
  // HTTP 헤더
  'authorization',
  'cookie',
  'set-cookie',
  'setcookie',
  // Market Gateway HMAC 헤더 (cross-cutting/market-gateway.md)
  // x-gw-sig 자체는 HMAC 결과 (재현 불가) 이지만, x-gw-ts 와 함께 노출되면 replay 공격
  // 표면이 약간 늘어남. Edge Function 로그 / Sentry 양쪽 모두 마스킹.
  'x-gw-sig',
  'x-gw-ts',
  'xgwsig',
  'xgwts',
  // OAuth code (10분짜리지만 복원 시 토큰 발급 가능)
  'code',
  'pkce_verifier',
  'pkceverifier',
  'state',
])

const JWT_PATTERN = /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
/** Bearer xxx 형태에서 토큰 추출 (Authorization 헤더 등). */
const BEARER_PATTERN = /Bearer\s+([A-Za-z0-9._-]+)/g

function maskString(key: string, value: string): string {
  if (REDACT_KEYS.has(key.toLowerCase())) {
    return `[REDACT:${key}:len=${value.length}]`
  }
  if (JWT_PATTERN.test(value)) {
    return `[REDACT:jwt:len=${value.length}]`
  }
  // Authorization 헤더 본문에 Bearer 가 섞여 있어도 마스킹
  if (BEARER_PATTERN.test(value)) {
    return value.replace(BEARER_PATTERN, (_m, t: string) => `Bearer [REDACT:bearer:len=${t.length}]`)
  }
  return value
}

/**
 * 재귀 마스킹. 깊이 제한 6 — 순환 참조 / 폭주 방지.
 */
export function maskRecord(value: unknown, depth = 0, parentKey = ''): unknown {
  if (depth > 6) return '[REDACT:depth]'
  if (value == null) return value
  if (typeof value === 'string') {
    return maskString(parentKey, value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskRecord(v, depth + 1, parentKey))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        if (typeof v === 'string') {
          out[k] = `[REDACT:${k}:len=${v.length}]`
        } else if (v == null) {
          out[k] = v
        } else {
          out[k] = '[REDACT]'
        }
      } else {
        out[k] = maskRecord(v, depth + 1, k)
      }
    }
    return out
  }
  // 그 외 (function, symbol, bigint) — 외부 송출에 들어갈 일 없음
  return '[REDACT:unsupported]'
}

/**
 * 에러를 안전한 형태로 변환. message / name / 마스킹된 cause / stack(짧게) 만 남김.
 * 토큰 패턴은 message 와 cause 양쪽에서 마스킹된다.
 */
export function maskError(err: unknown): Record<string, unknown> {
  if (err == null) return { name: 'unknown' }
  if (err instanceof Error) {
    const base: Record<string, unknown> = {
      name: err.name,
      message: maskString('message', err.message),
    }
    // MarketError 등의 context (security.md §6.4 응답 패턴)
    const ctx = (err as unknown as { context?: unknown }).context
    if (ctx != null) {
      base.context = maskRecord(ctx, 0, 'context')
    }
    const code = (err as unknown as { code?: unknown }).code
    if (code != null && typeof code === 'string') {
      base.code = code
    }
    // stack 은 처음 6 줄만 (Deno V8 출력)
    if (err.stack) {
      const lines = err.stack.split('\n').slice(0, 6).join('\n')
      base.stack = maskString('stack', lines)
    }
    return base
  }
  if (typeof err === 'object') {
    return maskRecord(err) as Record<string, unknown>
  }
  return { value: maskString('value', String(err)) }
}
