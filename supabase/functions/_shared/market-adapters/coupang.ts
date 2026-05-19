/**
 * 쿠팡 어댑터 (stub).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (마켓별 차이)
 *
 * 상태: SIGNATURE ONLY — 본문 미구현.
 *
 * 미해결 (OQ-10 — Phase 2 확정):
 *   - 쿠팡 OAuth 표준 준수 여부 (벤더 비표준 절차 가능성)
 *   - 토큰 / 카테고리 / 상품 등록 endpoint URL
 *   - refresh TTL (잠정 30일)
 *   - 429 응답 헤더 포맷 (Retry-After vs 자체)
 *   - HTTP timeout (잠정 20s)
 *   - "200 응답 + 자체 code 필드로 실패 표기" quirk → unknown 매핑 (market-adapter.md §9.4)
 *
 * 강제 (구현 시점):
 *   - 인증 헤더는 HMAC 서명 가능성 — VENDOR_ID + ACCESS_KEY + SECRET_KEY 조합 (env.ts).
 *   - createProduct 응답에서 부분 성공이 빈번 → CreateProductResult.status = 'partial' + warnings 적극 활용.
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

const MARKET = 'coupang' as const

export function createCoupangAdapter(): MarketAdapter {
  return {
    market: MARKET,

    authenticate(_code: string): Promise<TokenSet> {
      throw new MarketError(
        'unknown',
        'coupang adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    refreshToken(_refresh: string): Promise<TokenSet> {
      throw new MarketError(
        'unknown',
        'coupang adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    fetchCategoryTree(): Promise<CategoryNode[]> {
      throw new MarketError(
        'unknown',
        'coupang adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    transformProduct(
      _product: Product,
      _mapping: MarketMapping,
    ): MarketPayload {
      throw new MarketError(
        'unknown',
        'coupang adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },

    createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw new MarketError(
        'unknown',
        'coupang adapter not implemented — OQ-10 confirmation required',
        { market: MARKET },
      )
    },
  }
}
