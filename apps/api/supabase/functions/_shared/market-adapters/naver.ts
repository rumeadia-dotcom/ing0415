/**
 * 네이버 스마트스토어 Edge Function 어댑터 (real stub).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9.1 (OAuth / 호출)
 *   - WIP-5markets-mvp.md C-1 Phase 5 (wiring)
 *
 * 상태 (C-1 Phase 1~5 완료):
 *   - authenticate / refreshToken / fetchCategoryTree / transformProduct /
 *     createProduct 본 stub 는 여전히 SIGNATURE ONLY (`unknown` throw).
 *   - 실 OAuth token exchange 는 본 어댑터가 아닌
 *     `markets-oauth-callback/naver.ts` (`exchangeNaverAuthCode`) 가 권위.
 *   - 실 OAuth refresh 는 `markets-token-refresh-cron` + `markets-token-refresh`
 *     (on_demand) 가 권위 — 본 어댑터 stub 의 refreshToken 호출은 도달하지 않음.
 *   - 카테고리·상품 등록 호출은 Wave 5 추후 PR 에서 FE real 어댑터 미러로 채움.
 *
 * v1 변경 (2026-05-19, Wave 1/2):
 *   - authenticate(input: AuthInput) — input.kind='oauth_code' 만 수용.
 *   - 반환 타입 StoredCredential (kind='oauth' + TokenSet payload).
 *   - refreshToken 은 OAuth 전용으로 제공 (네이버 한정).
 *
 * 미해결 (OQ-11 — Wave 5 시작 시 확정):
 *   - scope 키 이름 (잠정 `commerce.products`)
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

    // 네이버 real 어댑터는 전체 stub — 저장 토큰 주입은 Wave 5 본구현 시.
    hydrate(stored: StoredCredential): void {
      void stored
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
