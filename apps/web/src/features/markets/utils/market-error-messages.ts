import type { MarketApiError } from '@/lib/schemas/markets-feature'

/**
 * markets Edge Function 에러 code → 한국어 메시지 매핑.
 * 마스터: docs/architecture/v1/features/markets.md §10
 */

export type MarketErrorCode =
  | 'market_not_supported'
  | 'invalid_redirect'
  | 'duplicate_label'
  | 'invalid_state'
  | 'invalid_code'
  | 'oauth_denied'
  | 'market_unavailable'
  | 'rate_limited'
  | 'vault_unavailable'
  | 'forbidden'
  | 'not_found'
  | 'unauthorized'
  | 'internal'
  | 'unknown'

const MESSAGE_MAP: Record<MarketErrorCode, string> = {
  market_not_supported: '현재 지원하지 않는 마켓입니다. (v2 예정)',
  invalid_redirect: '복귀 경로가 올바르지 않습니다. 다시 시도해 주세요.',
  duplicate_label: '이미 사용 중인 라벨입니다. 다른 이름을 사용하세요.',
  invalid_state: '보안 검증에 실패했습니다. 처음부터 다시 시도해 주세요.',
  invalid_code: '인증 코드가 만료되었거나 이미 사용되었습니다.',
  oauth_denied: '마켓에서 권한 부여를 거부했습니다.',
  market_unavailable: '마켓 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  rate_limited: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  vault_unavailable: '내부 보안 저장소 오류입니다. 운영팀에 자동 알림되었습니다.',
  forbidden: '해당 계정을 찾을 수 없습니다.',
  not_found: '해당 계정을 찾을 수 없습니다.',
  unauthorized: '다시 로그인해 주세요.',
  internal: '알 수 없는 오류입니다. 문의 시 요청 ID 를 알려주세요.',
  unknown: '알 수 없는 오류가 발생했습니다.',
}

function toCode(raw: string | undefined): MarketErrorCode {
  if (!raw) return 'unknown'
  return raw in MESSAGE_MAP ? (raw as MarketErrorCode) : 'unknown'
}

export interface FormattedMarketError {
  code: MarketErrorCode
  message: string
  correlationId: string | null
}

export function formatMarketError(err: Partial<MarketApiError> | null | undefined): FormattedMarketError {
  const code = toCode(err?.code)
  return {
    code,
    message: MESSAGE_MAP[code],
    correlationId: err?.correlationId ?? null,
  }
}

export { MESSAGE_MAP as MARKET_ERROR_MESSAGES }
