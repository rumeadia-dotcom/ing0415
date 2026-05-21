/**
 * MarketError → shipping_job_results.error_code 매핑.
 *
 * registration 의 error-map 과 동일 표를 따르되, shipping 도메인 코드 집합으로 매핑.
 * (image_invalid / quota_exceeded 는 shipping 에 부적합 — duplicate 만 추가.)
 */

import type { MarketErrorCode } from '../../_shared/index.ts'
import type { ShippingErrorCode } from '../../shipping-dispatch-job/lib/types.ts'

export function mapMarketErrorToShippingCode(
  code: MarketErrorCode,
  oauthRefreshFailed: boolean,
): ShippingErrorCode {
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
 * 재시도 불가 코드 — 한 번이라도 들어가면 즉시 failed_final.
 */
export function isFinalShippingErrorCode(code: ShippingErrorCode): boolean {
  return (
    code === 'oauth_revoked' ||
    code === 'validation' ||
    code === 'duplicate' ||
    code === 'unknown'
  )
}
