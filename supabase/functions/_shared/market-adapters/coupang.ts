/**
 * 쿠팡 어댑터 — v1 미사용 (오픈 준비중).
 *
 * 쿠팡 OpenAPI 는 OAuth 가 아닌 HMAC 기반(VENDOR_ID + ACCESS_KEY + SECRET_KEY) 이므로
 * OAuth 가정 어댑터 인터페이스와 부정합. v2 에서 어댑터 인터페이스 확장
 * (`authenticate` input 을 `{kind:'oauth_code'|'hmac_key', ...}` union 으로 확대)
 * + HMAC 어댑터로 재설계 예정 (2026-05-19 결정 — OQ-10).
 *
 * 본 파일은 인터페이스 호환을 위해 stub 만 유지 — 사용 시 즉시 throw.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.6 (확장 정책)
 *   - CLAUDE.md "MVP 범위 (v1)"
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
const NOT_IN_V1 = 'Coupang adapter is not in v1 (오픈 준비중) — see CLAUDE.md MVP 범위'

export function createCoupangAdapter(): MarketAdapter {
  return {
    market: MARKET,

    authenticate(_code: string): Promise<TokenSet> {
      throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
    },

    refreshToken(_refresh: string): Promise<TokenSet> {
      throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
    },

    fetchCategoryTree(): Promise<CategoryNode[]> {
      throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
    },

    transformProduct(
      _product: Product,
      _mapping: MarketMapping,
    ): MarketPayload {
      throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
    },

    createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
    },
  }
}
