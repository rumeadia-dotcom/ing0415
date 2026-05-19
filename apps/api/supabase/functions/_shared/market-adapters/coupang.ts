/**
 * 쿠팡 어댑터 (real stub).
 *
 * v1 라인업 (2026-05-19, Wave 1/2): 활성.
 *   - 인증 = HMAC (VENDOR_ID + ACCESS_KEY + SECRET_KEY). OAuth 아님.
 *   - credentialKind = 'hmac'. refreshToken 정의 없음 (영구 키).
 *   - debug 빌드는 createMockAdapter('coupang') 사용. real 빌드는 본 stub 으로 진입 → throw (Wave 5).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (확장 정책)
 *   - CLAUDE.md "MVP 범위 (v1)"
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
} from '../schemas.ts'
import type { MarketAdapter } from '../market-adapter.ts'

const MARKET = 'coupang' as const
const NOT_IMPL =
  'coupang real adapter not implemented — Wave 5 HMAC 본문 구현 예정'

export function createCoupangAdapter(): MarketAdapter {
  return {
    market: MARKET,
    credentialKind: 'hmac',
    // refreshToken: undefined (HMAC = 영구 키)

    authenticate(_input: AuthInput): Promise<StoredCredential> {
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
