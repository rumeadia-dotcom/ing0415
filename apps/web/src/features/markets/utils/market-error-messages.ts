import type { MarketApiError } from '@/lib/schemas/markets-feature'

/**
 * markets Edge Function 에러 code → 한국어 메시지 매핑.
 * 마스터: docs/architecture/v1/features/markets.md §10
 *
 * 정밀도 (2026-05-23 hotfix/v0.9.7):
 * - 어댑터 에러 분류 (unauthorized / validation / network / server / rate_limit)
 *   별로 별도 code 부여
 * - details.market 가 있으면 마켓명 prefix 자동 부착
 * - details.stage 가 있으면 단계별 보조 안내 부착
 *
 * 신규 코드 (v0.9.7):
 *   credentials_unauthorized — 마켓이 키 거부 (401/403)
 *   credentials_invalid      — 키 형식 검증 실패 (4xx validation)
 *   market_network           — 마켓 서버 도달 실패 (timeout / 502 / 504)
 *   market_server            — 마켓 서버 5xx
 *   category_ping_failed     — 자격증명 OK 였지만 카테고리 조회 단계 실패
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
  // v0.9.7 신규
  | 'credentials_unauthorized'
  | 'credentials_invalid'
  | 'market_network'
  | 'market_server'
  | 'category_ping_failed'
  | 'invalid_credentials' // legacy (markets-oauth-callback 등 다른 함수 호환)

/** 시스템 영문 마켓 ID → 한국어 표기. UI prefix 에 사용. */
const MARKET_LABEL: Record<string, string> = {
  naver: '네이버 스마트스토어',
  coupang: '쿠팡',
  gmarket: 'G마켓',
  auction: '옥션',
  '11st': '11번가',
}

/** 단계별 보조 안내. authenticate / category_ping / vault / account 등. */
const STAGE_HINT: Record<string, string> = {
  authenticate: '자격증명 검증 단계',
  category_ping: '카테고리 조회 단계',
  vault: '자격증명 저장 단계',
  account: '계정 저장 단계',
  account_lookup: '계정 조회 단계',
  vault_revoke: '자격증명 해제 단계',
  account_revoke: '계정 해제 단계',
}

const MESSAGE_MAP: Record<MarketErrorCode, string> = {
  market_not_supported: '현재 지원하지 않는 마켓입니다.',
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
  // v0.9.7 신규
  credentials_unauthorized:
    '자격증명이 거부되었습니다. Access Key / Secret Key 를 다시 확인해 주세요.',
  credentials_invalid:
    '자격증명 형식이 잘못되었습니다. 필수 항목이 모두 입력되었는지 확인해 주세요.',
  market_network:
    '마켓 서버에 도달하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  market_server:
    '마켓 서버에 일시적인 장애가 있습니다. 잠시 후 다시 시도해 주세요.',
  category_ping_failed:
    '자격증명은 확인되었지만 카테고리 조회에 실패했습니다. 운영팀에 자동 알림되었습니다.',
  invalid_credentials:
    '자격증명이 거부되었습니다. Access Key / Secret Key 를 다시 확인해 주세요.',
}

function toCode(raw: string | undefined): MarketErrorCode {
  if (!raw) return 'unknown'
  return raw in MESSAGE_MAP ? (raw as MarketErrorCode) : 'unknown'
}

export interface FormattedMarketError {
  code: MarketErrorCode
  message: string
  correlationId: string | null
  /** UI 가 "자세히" 영역에 노출할 보조 정보 (stage / market). */
  hint: string | null
}

/**
 * 마켓 에러 응답을 사용자에게 보여줄 메시지로 변환.
 *
 *  - details.market 이 있으면 메시지 앞에 "**G마켓**: " 같은 prefix
 *  - details.stage 가 있으면 hint 에 단계 안내 ("카테고리 조회 단계")
 *  - 알 수 없는 code 는 unknown 폴백
 */
export function formatMarketError(
  err: Partial<MarketApiError> | null | undefined,
): FormattedMarketError {
  const code = toCode(err?.code)
  const base = MESSAGE_MAP[code]

  const marketRaw = err?.details?.market
  const marketLabel = marketRaw ? MARKET_LABEL[marketRaw] ?? marketRaw : null
  const message = marketLabel ? `[${marketLabel}] ${base}` : base

  const stage = err?.details?.stage
  const hint = stage ? (STAGE_HINT[stage] ?? null) : null

  return {
    code,
    message,
    correlationId: err?.correlationId ?? null,
    hint,
  }
}

export { MESSAGE_MAP as MARKET_ERROR_MESSAGES, MARKET_LABEL, STAGE_HINT }
