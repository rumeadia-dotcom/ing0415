/**
 * 로젠 SDK 전용 에러 클래스 + resultCd → code 매핑.
 *
 * 마스터: docs/spec/PRD-v2-shipping.md §3
 *
 * 분류:
 *   - unauthorized — 401/403, 또는 resultCd 가 인증 거부 코드 (잘못된 userId/custCd).
 *   - rate_limit   — 429.
 *   - validation   — 400/422, 또는 resultCd 가 입력 검증 거부 (필수필드 누락 등).
 *   - network      — fetch abort / DNS / TCP / timeout.
 *   - server       — 5xx, 또는 resultCd 가 시스템 오류.
 *   - unknown      — 매핑되지 않는 모든 경우.
 *
 * resultCd 매핑은 Logen 공식 명세가 비공개라 대표적인 prefix 규칙으로만 분기:
 *   - '00' / 'OK' / 'SUCCESS' → 성공 (에러 아님, 호출측에서 분기)
 *   - 'AUTH*' / 'E40[13]' → unauthorized
 *   - 'VAL*' / 'E400' → validation
 *   - 'SYS*' / 'E5*' → server
 *   - 그 외 → unknown
 * 실제 운영 키 매핑은 베타 검증 후 본 모듈에서 보정한다 (PR description 명시).
 */

export type LogenErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

export interface LogenErrorContext {
  /** HTTP status (있을 때) */
  status?: number
  /** Logen 응답 resultCd */
  resultCd?: string
  /** Logen 응답 메시지 (resultMsg / errorMsg / errMsg 중 하나, 마스킹 전) */
  resultMsg?: string
  /** retry 권장 시간 (rate_limit 만) */
  retryAfterMs?: number
  /** correlationId (요청 단위) */
  correlationId?: string
  /** 원인 (fetch 에러 등) */
  cause?: unknown
}

export class LogenError extends Error {
  readonly code: LogenErrorCode
  readonly context: LogenErrorContext

  constructor(code: LogenErrorCode, message: string, context: LogenErrorContext = {}) {
    super(message)
    this.name = 'LogenError'
    this.code = code
    this.context = context
  }

  get retryable(): boolean {
    return (
      this.code === 'rate_limit' ||
      this.code === 'server' ||
      this.code === 'network'
    )
  }
}

/**
 * HTTP 상태 → LogenErrorCode.
 *  - 200/201 은 본 함수 호출 전 호출측이 분기.
 */
export function httpStatusToLogenCode(status: number): LogenErrorCode {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limit'
  if (status === 400 || status === 422) return 'validation'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * Logen resultCd → LogenErrorCode.
 *  - 성공 코드 (`'00'` / `'OK'` / `'SUCCESS'` / `'S'`) 는 null 반환.
 */
export function resultCdToLogenCode(resultCd: string): LogenErrorCode | null {
  const cd = resultCd.toUpperCase().trim()
  if (cd === '00' || cd === '0' || cd === 'OK' || cd === 'SUCCESS' || cd === 'S') {
    return null
  }
  // 인증·권한 거부
  if (cd.startsWith('AUTH') || cd === 'E401' || cd === 'E403') {
    return 'unauthorized'
  }
  // 입력 검증
  if (cd.startsWith('VAL') || cd === 'E400' || cd === 'E422' || cd.startsWith('INV')) {
    return 'validation'
  }
  // rate limit
  if (cd === 'E429' || cd.startsWith('RATE')) {
    return 'rate_limit'
  }
  // 서버 / 시스템 오류
  if (cd.startsWith('SYS') || cd.startsWith('E5') || cd === 'F') {
    return 'server'
  }
  return 'unknown'
}
