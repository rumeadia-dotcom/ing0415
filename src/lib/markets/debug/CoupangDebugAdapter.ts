import { MarketError } from '../errors'
import type { MarketAdapter } from '../types'
import type {
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  TokenSet,
} from '@/lib/schemas'

/**
 * 쿠팡 debug 어댑터 — v1 미사용 (오픈 준비중).
 * 쿠팡 OpenAPI 는 OAuth 가 아닌 HMAC 기반이므로 OAuth 가정 어댑터 인터페이스와 부정합.
 * v2 에서 어댑터 인터페이스 확장 + HMAC 어댑터로 재설계 예정 (2026-05-19 결정 — OQ-10).
 * 본 파일은 인터페이스 호환을 위해 유지 — 사용 시 throw.
 */

const MARKET = 'coupang' as const
const NOT_IN_V1 = 'Coupang adapter is not in v1 (오픈 준비중)'

export const coupangDebugAdapter: MarketAdapter = {
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
  transformProduct(_product: Product, _mapping: MarketMapping): MarketPayload {
    throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
  },
  createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
    throw new MarketError('unknown', NOT_IN_V1, { market: MARKET })
  },
}
