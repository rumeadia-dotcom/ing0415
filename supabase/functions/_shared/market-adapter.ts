/**
 * MarketAdapter 인터페이스 (Edge Function 측 미러).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §2.1
 *   - src/lib/markets/types.ts (클라이언트 단일 출처)
 *
 * 강제:
 *   - 5메서드만. 6번째 추가는 backend + architect + security 3자 승인.
 *   - retry / 로깅 / Sentry / 이미지 변환은 어댑터 바깥 (registration-run 오케스트레이터).
 *   - 어댑터는 throw MarketError 만. 응답 코드 200 인 실패도 어댑터에서 분류.
 */

import type {
  CategoryNode,
  CreateProductResult,
  MarketId,
  MarketMapping,
  MarketPayload,
  Product,
  TokenSet,
} from './schemas.ts'

export interface MarketAdapter {
  readonly market: MarketId

  authenticate(code: string): Promise<TokenSet>
  refreshToken(refresh: string): Promise<TokenSet>
  fetchCategoryTree(): Promise<CategoryNode[]>
  transformProduct(product: Product, mapping: MarketMapping): MarketPayload
  createProduct(payload: MarketPayload): Promise<CreateProductResult>
}
