/**
 * G마켓 어댑터 (real stub).
 *
 * v1 라인업 (2026-05-19, Wave 2): 활성.
 *   - 인증 = ESM 2.0 JWT (masterId + secretKey + sellerId + site='G').
 *   - credentialKind = 'esm_jwt'. refreshToken 정의 없음 (영구 키).
 *   - debug 빌드는 createMockAdapter('gmarket'). real 빌드 진입 시 throw (Wave 5 예정).
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

const MARKET = 'gmarket' as const
const NOT_IMPL =
  'gmarket real adapter not implemented — Wave 5 ESM JWT 본문 구현 예정'

export function createGmarketAdapter(): MarketAdapter {
  return {
    market: MARKET,
    credentialKind: 'esm_jwt',

    authenticate(_input: AuthInput): Promise<StoredCredential> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },
    fetchCategoryTree(): Promise<CategoryNode[]> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },
    transformProduct(_p: Product, _m: MarketMapping): MarketPayload {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },
    createProduct(_payload: MarketPayload): Promise<CreateProductResult> {
      throw new MarketError('unknown', NOT_IMPL, { market: MARKET })
    },
  }
}
