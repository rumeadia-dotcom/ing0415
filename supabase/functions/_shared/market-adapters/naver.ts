/**
 * 네이버 스마트스토어 어댑터 (stub).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.1 (OAuth / 호출)
 *
 * 상태: SIGNATURE ONLY — 본문 미구현.
 *
 * 미해결 (OQ-10 — Phase 2 통합 시작 시 확정):
 *   - 실제 OAuth authorize / token endpoint URL
 *   - scope 키 이름
 *   - refresh TTL (잠정 14일)
 *   - 429 Retry-After 헤더 표준 준수 여부
 *   - HTTP timeout (잠정 15s)
 *   - 카테고리 트리 응답 스키마 (전체 1회 vs lazy)
 *
 * 강제 (구현 시점):
 *   - fetch 1회만. retry / 큐 / 이미지 변환은 호출측 (registration-run + with-retry).
 *   - 마켓 응답을 받은 즉시 마켓별 zod 로 parse → 실패 = MarketError('validation').
 *   - 200 응답에 마켓 자체 error code 가 들어올 경우 unknown 으로 매핑 (market-adapter.md §9.4 quirk).
 *   - 모든 throw 는 MarketError. 어댑터에서 logger / Sentry 직접 호출 금지.
 */

import { MarketError } from '../errors.ts'
import type {
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  TokenSet,
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'

const MARKET = 'naver' as const

export function createNaverAdapter(): MarketAdapter {
  return {
    market: MARKET,

    authenticate(_code: string): Promise<TokenSet> {
      throw new MarketError(
        'unknown',
        'naver adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    refreshToken(_refresh: string): Promise<TokenSet> {
      throw new MarketError(
        'unknown',
        'naver adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    fetchCategoryTree(): Promise<CategoryNode[]> {
      throw new MarketError(
        'unknown',
        'naver adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    transformProduct(
      _product: Product,
      _mapping: MarketMapping,
    ): MarketPayload {
      // 순수 함수. 실제 구현 시 마켓 필수 필드 채움 + 마켓별 zod 검증.
      throw new MarketError(
        'unknown',
        'naver adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw new MarketError(
        'unknown',
        'naver adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },
  }
}
