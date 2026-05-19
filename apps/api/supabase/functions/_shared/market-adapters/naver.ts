/**
 * 네이버 스마트스토어 어댑터 (real stub).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.1 (OAuth / 호출)
 *
 * 상태: SIGNATURE ONLY — 본문 미구현 (real 빌드 진입 시 throw).
 *
 * v1 변경 (2026-05-19, Wave 1/2):
 *   - authenticate(input: AuthInput) — input.kind='oauth_code' 만 수용.
 *   - 반환 타입 StoredCredential (kind='oauth' + TokenSet payload).
 *   - refreshToken 은 OAuth 전용으로 제공 (네이버 한정).
 *
 * 미해결 (OQ-11 — Wave 5 시작 시 확정):
 *   - 실제 OAuth authorize / token endpoint URL
 *   - scope 키 이름
 *   - refresh TTL (잠정 14일)
 *   - 429 Retry-After 헤더 표준 준수 여부
 *   - HTTP timeout (잠정 15s)
 *   - 카테고리 트리 응답 스키마 (전체 1회 vs lazy)
 */

import { MarketError } from '../errors.ts'
import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketMapping,
  MarketPayload,
  Product,
  StoredCredential,
  TokenSet,
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'

const MARKET = 'naver' as const
const NOT_IMPL =
  'naver real adapter not implemented — OQ-11 confirmation required (Wave 5)'

export function createNaverAdapter(): MarketAdapter {
  return {
    market: MARKET,
    credentialKind: 'oauth',

    authenticate(_input: AuthInput): Promise<StoredCredential> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },

    refreshToken(_refresh: string): Promise<TokenSet> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },

    fetchCategoryTree(): Promise<CategoryNode[]> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },

    transformProduct(
      _product: Product,
      _mapping: MarketMapping,
    ): MarketPayload {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },

    createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },
  }
}
