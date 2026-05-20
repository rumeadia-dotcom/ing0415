/**
 * MarketError → jmr.error_code 매핑 (state.md §6.2.1 단일 출처).
 *
 * 호출측은 oauthRefreshFailed 플래그로 unauthorized 의 분기를 결정.
 */

import type { JobMarketErrorCode, MarketErrorCode } from '../../_shared/index.ts'

export function mapMarketErrorToJmrCode(
  code: MarketErrorCode,
  oauthRefreshFailed: boolean,
): JobMarketErrorCode {
  switch (code) {
    case 'unauthorized':
      return oauthRefreshFailed ? 'oauth_revoked' : 'oauth_expired'
    case 'rate_limit':
      return 'rate_limit'
    case 'validation':
      return 'validation'
    case 'network':
      return 'timeout'
    case 'server':
      return 'market_5xx'
    case 'unknown':
    default:
      return 'unknown'
  }
}

/**
 * 재시도 불가 코드 (state.md §6.2). 한 번이라도 들어가면 즉시 failed_final.
 * - 재시도 가능 코드(rate_limit / timeout / market_5xx / oauth_expired) 는 attempt_count 한도까지만 재시도.
 */
export function isFinalErrorCode(code: JobMarketErrorCode): boolean {
  return (
    code === 'oauth_revoked' ||
    code === 'validation' ||
    code === 'image_invalid' ||
    code === 'duplicate' ||
    code === 'quota_exceeded' ||
    code === 'unknown'
  )
}
