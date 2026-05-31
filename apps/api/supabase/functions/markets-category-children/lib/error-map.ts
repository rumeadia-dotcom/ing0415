/**
 * markets-category-children — MarketError → HTTP 응답 매핑 (Deno 의존 0, Vitest 회귀).
 *
 * 어댑터가 throw 하는 MarketError 의 code 를 사용자 노출 HTTP status/code 로 변환한다.
 *   - unauthorized → 401 (자격증명 무효/만료 — 재인증 필요)
 *   - validation   → 400 (요청/응답 검증 실패)
 *   - rate_limit   → 429
 *   - network/server/unknown 등 그 외 → 502 (외부 마켓/게이트웨이 도달·응답 문제)
 *
 * 네이버 NOT_IMPL(code='unknown')은 Edge 진입에서 fetchCategoryChildren 미구현으로
 * 선차단되지만, 혹시 throw 시 호출측이 category_not_supported 로 매핑할 수 있도록
 * isNaverNotImplemented 를 별도 제공한다.
 *
 * 마스터: docs/architecture/v1/features/category-sync.md §4
 */

export interface CategoryErrorHttp {
  status: number
  code: string
}

/** MarketError code → HTTP status/code. message 는 호출측이 결정(PII 마스킹). */
export function marketErrorToHttp(marketErrorCode: string): CategoryErrorHttp {
  switch (marketErrorCode) {
    case 'unauthorized':
      return { status: 401, code: 'market_unauthorized' }
    case 'validation':
      return { status: 400, code: 'market_validation' }
    case 'rate_limit':
      return { status: 429, code: 'rate_limit' }
    default:
      // network / server / unknown — 외부 도달/응답 문제 = 502.
      return { status: 502, code: 'market_bad_gateway' }
  }
}
