import type {
  CategoryNode,
  CreateProductResult,
  MarketId,
  MarketMapping,
  MarketPayload,
  Product,
  TokenSet,
} from '@/lib/schemas'

/**
 * MarketAdapter — 5메서드 인터페이스 (강제).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §2.1
 *
 * 신규 마켓 추가 = 본 인터페이스를 구현하는 1파일 + 단위 테스트.
 * 6번째 메서드 추가 / 시그니처 변경은 market-adapter.md 개정 절차(backend +
 * architect + security 3자 승인) 필수.
 *
 * 어댑터는 fetch retry / 이미지 변환 / 로깅 / 큐 처리를 직접 하지 않는다.
 * 호출측(`registration-run` Edge Function) 의 wrapper 책임.
 */
export interface MarketAdapter {
  /** 어댑터 인스턴스가 다루는 마켓 ID. */
  readonly market: MarketId

  /**
   * OAuth authorization_code → token 교환.
   * @throws MarketError('unauthorized' | 'validation' | 'network' | 'server' | 'unknown')
   */
  authenticate(code: string): Promise<TokenSet>

  /**
   * refresh_token → token 갱신. rotation 발급 시 새 refresh 그대로 반환.
   * @throws MarketError('unauthorized') 시 호출측에서 disconnected 처리.
   */
  refreshToken(refresh: string): Promise<TokenSet>

  /**
   * 마켓 카테고리 트리. 캐시는 호출측 책임. 어댑터는 호출 + zod 검증 + 트리 정규화.
   */
  fetchCategoryTree(): Promise<CategoryNode[]>

  /**
   * 도메인 Product + MarketMapping → 마켓 페이로드.
   * 순수 함수. fetch / Date.now / Math.random 사용 금지 (결정성).
   */
  transformProduct(product: Product, mapping: MarketMapping): MarketPayload

  /**
   * 마켓에 상품 생성 요청. externalId + productUrl + status 반환.
   */
  createProduct(payload: MarketPayload): Promise<CreateProductResult>
}
