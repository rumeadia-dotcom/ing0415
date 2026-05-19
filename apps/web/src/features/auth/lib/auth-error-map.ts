import type { AuthError } from '@supabase/supabase-js'

/**
 * Supabase Auth 에러 → 한국어 사용자 메시지 매핑.
 * 마스터: docs/architecture/v1/features/auth.md §7.2
 *
 * - Sentry 송출 정책은 별도 (auth.md §7.3) — 본 함수는 표시 문구만 결정.
 * - 알 수 없는 에러는 일반 메시지 + raw 보존 (ErrorMessage details 로 노출).
 */

export interface MappedAuthError {
  /** 사용자에게 노출할 짧은 메시지 */
  message: string
  /** ErrorMessage 의 details (raw response 등) — 알 수 없는 에러에서만 채움 */
  details?: string
  /** Sentry 송출 여부 결정용 (auth.md §7.3) */
  shouldReport: boolean
  /** 에러 카테고리 (audit_log 사유) */
  code: AuthErrorCode
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_address_invalid'
  | 'weak_password'
  | 'same_password'
  | 'user_already_exists'
  | 'over_rate_limit'
  | 'provider_email_needs_verification'
  | 'oauth_denied'
  | 'oauth_provider_not_supported'
  | 'otp_expired'
  | 'session_not_found'
  | 'network'
  | 'server'
  | 'unknown'

const MESSAGE_MAP: Record<AuthErrorCode, string> = {
  invalid_credentials: '이메일 또는 비밀번호가 올바르지 않습니다',
  email_not_confirmed: '이메일 인증이 완료되지 않았습니다',
  email_address_invalid: '올바른 이메일 형식이 아닙니다',
  weak_password: '비밀번호 정책을 충족하지 않습니다',
  same_password: '기존 비밀번호와 동일합니다',
  user_already_exists: '메일을 발송했습니다',
  over_rate_limit: '잠시 후 다시 시도해주세요',
  provider_email_needs_verification: '이메일 인증이 완료된 소셜 계정만 사용 가능합니다',
  oauth_denied: '소셜 로그인이 취소되었습니다',
  oauth_provider_not_supported: '지원하지 않는 로그인 방식입니다',
  otp_expired: '재설정 링크가 만료되었습니다. 다시 요청해주세요',
  session_not_found: '다시 로그인해주세요',
  network: '네트워크 연결을 확인해주세요',
  server: '일시적인 오류입니다. 잠시 후 다시 시도해주세요',
  unknown: '알 수 없는 오류가 발생했습니다',
}

const SHOULD_REPORT: Record<AuthErrorCode, boolean> = {
  invalid_credentials: false,
  email_not_confirmed: false,
  email_address_invalid: false,
  weak_password: false,
  same_password: false,
  user_already_exists: false,
  over_rate_limit: false,
  provider_email_needs_verification: false,
  oauth_denied: false,
  oauth_provider_not_supported: true,
  otp_expired: false,
  session_not_found: false,
  network: false,
  server: true,
  unknown: true,
}

/**
 * Supabase AuthError 또는 generic Error 를 한국어 메시지로 매핑.
 */
export function mapAuthError(err: unknown): MappedAuthError {
  const code = classifyAuthError(err)
  const result: MappedAuthError = {
    message: MESSAGE_MAP[code],
    shouldReport: SHOULD_REPORT[code],
    code,
  }
  if (code === 'unknown') {
    const raw = serializeRaw(err)
    if (raw) result.details = raw
  }
  return result
}

function classifyAuthError(err: unknown): AuthErrorCode {
  if (!err) return 'unknown'

  // 네트워크 에러 (fetch fail) — TypeError 형태로 옴
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return 'network'
  }

  if (isAuthErrorLike(err)) {
    const code = (err.code ?? '').toLowerCase()
    const msg = err.message.toLowerCase()
    const status = err.status

    if (code === 'invalid_credentials' || /invalid login credentials/.test(msg)) {
      return 'invalid_credentials'
    }
    if (code === 'email_not_confirmed' || /email.*not.*confirmed/.test(msg)) {
      return 'email_not_confirmed'
    }
    if (code === 'email_address_invalid' || /invalid email/.test(msg)) {
      return 'email_address_invalid'
    }
    if (code === 'weak_password' || /weak password|password.*requirements/.test(msg)) {
      return 'weak_password'
    }
    if (code === 'same_password' || /new password.*same/.test(msg)) {
      return 'same_password'
    }
    if (code === 'user_already_exists' || /user.*already.*registered/.test(msg)) {
      return 'user_already_exists'
    }
    if (
      code === 'over_email_send_rate_limit' ||
      code === 'over_request_rate_limit' ||
      status === 429
    ) {
      return 'over_rate_limit'
    }
    if (code === 'otp_expired' || /token.*expired|otp.*expired/.test(msg)) {
      return 'otp_expired'
    }
    if (code === 'session_not_found' || /session.*not.*found/.test(msg)) {
      return 'session_not_found'
    }
    if (typeof status === 'number' && status >= 500) {
      return 'server'
    }
  }

  return 'unknown'
}

function isAuthErrorLike(err: unknown): err is AuthError & { code?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  )
}

function serializeRaw(err: unknown): string | undefined {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ''}`
  }
  try {
    return JSON.stringify(err, null, 2)
  } catch {
    return undefined
  }
}
