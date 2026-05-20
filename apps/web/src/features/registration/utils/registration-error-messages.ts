/**
 * registration Edge Function 에러 code → 한국어 메시지 매핑.
 * 마스터: docs/architecture/v1/features/registration.md §6 / §12
 */

export type RegistrationErrorCode =
  // 6.2 validate
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden_product'
  | 'product_not_found'
  | 'market_unavailable'
  // 6.3 start
  | 'job_in_progress'
  // 6.5 retry
  | 'not_retryable'
  | 'retry_exceeded'
  // 6.6 cancel
  | 'already_finalized'
  // 공통
  | 'rate_limited'
  | 'internal'
  | 'unknown'

const MESSAGE_MAP: Record<RegistrationErrorCode, string> = {
  invalid_request: '요청 형식이 올바르지 않습니다. 다시 시도해 주세요.',
  unauthorized: '다시 로그인해 주세요.',
  forbidden_product: '해당 상품에 접근할 권한이 없습니다.',
  product_not_found: '상품을 찾을 수 없습니다.',
  market_unavailable: '마켓 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  job_in_progress: '이미 진행 중인 등록이 있습니다. 완료 또는 취소 후 다시 시도해 주세요.',
  not_retryable: '재시도할 수 없는 상태입니다.',
  retry_exceeded: '재시도 횟수를 초과했습니다.',
  already_finalized: '이미 종료된 잡입니다.',
  rate_limited: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  internal: '알 수 없는 오류입니다. 문의 시 요청 ID 를 알려주세요.',
  unknown: '알 수 없는 오류가 발생했습니다.',
}

function toCode(raw: string | undefined): RegistrationErrorCode {
  if (!raw) return 'unknown'
  return raw in MESSAGE_MAP ? (raw as RegistrationErrorCode) : 'unknown'
}

export interface FormattedRegistrationError {
  code: RegistrationErrorCode
  message: string
  correlationId: string | null
}

export function formatRegistrationError(
  err: { code?: string; correlationId?: string | null } | null | undefined,
): FormattedRegistrationError {
  const code = toCode(err?.code)
  return {
    code,
    message: MESSAGE_MAP[code],
    correlationId: err?.correlationId ?? null,
  }
}

/**
 * validation issue code (registration-validate 응답) → 한국어 메시지.
 * docs/architecture/v1/features/registration.md §12.
 */
const ISSUE_MESSAGE_MAP: Record<string, string> = {
  product_name_invalid: '상품명이 마켓 정책에 맞지 않습니다.',
  product_price_invalid: '판매가가 마켓 정책에 맞지 않습니다.',
  category_missing: '카테고리를 선택하세요.',
  category_not_leaf: '하위 카테고리를 선택하세요.',
  brand_required: '브랜드 입력이 필요합니다.',
  manufacturer_required: '제조사 입력이 필요합니다.',
  shipping_method_unsupported: '선택한 배송 방법이 마켓에서 지원되지 않습니다.',
  image_main_missing: '대표 이미지가 누락되었습니다.',
  image_size_too_small: '이미지 해상도가 마켓 기준보다 작습니다.',
  description_required: '상품 상세 설명이 필요합니다.',
  market_options_missing: '마켓별 옵션 입력이 필요합니다.',
  token_expired: '마켓 인증이 만료되었습니다. 재인증이 필요합니다.',
  token_revoked: '마켓 인증이 해제되었습니다. 다시 연결해 주세요.',
  mapping_not_found: '카테고리 매핑이 없습니다.',
}

export function formatValidationIssue(code: string): string {
  return ISSUE_MESSAGE_MAP[code] ?? '입력값을 확인해 주세요.'
}

export { MESSAGE_MAP as REGISTRATION_ERROR_MESSAGES, ISSUE_MESSAGE_MAP as VALIDATION_ISSUE_MESSAGES }
