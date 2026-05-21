import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  FetchOrdersInput,
  MarketCredentialKind,
  MarketId,
  MarketMapping,
  MarketOrder,
  MarketPayload,
  MarketSubmitTrackingResult,
  Product,
  StoredCredential,
  SubmitTrackingInput,
  TokenSet,
} from '@/lib/schemas'

/**
 * MarketAdapter — 7메서드 인터페이스 (강제, v2 확장 후).
 * 마스터: docs/architecture/v1/cross-cutting/market-adapter.md §2.1 / §9
 *
 * 신규 마켓 추가 = 본 인터페이스를 구현하는 1파일 + 단위 테스트.
 * 8번째 메서드 추가 / 시그니처 변경은 market-adapter.md 개정 절차(backend +
 * architect + security 3자 승인) 필수.
 *
 * 어댑터는 fetch retry / 이미지 변환 / 로깅 / 큐 처리를 직접 하지 않는다.
 * 호출측(`registration-run` / `orders-sync` / `shipping-dispatch-job` Edge
 * Function) 의 wrapper 책임.
 *
 * v1 변경 (2026-05-19):
 *  - `authenticate(input)` 의 input 이 4-way `AuthInput` discriminated union 으로 확장됨.
 *    OAuth code (네이버) / HMAC 키 (쿠팡) / ESM JWT (G마켓·옥션) / API Key (11번가) 분기.
 *  - `refreshToken` 은 OAuth (네이버) 에서만 사용 → optional. HMAC·ESM JWT·API Key 는 영구 키.
 *  - 반환 타입이 `TokenSet` → `StoredCredential` (kind + payload) 로 일반화.
 *
 * v2 변경 (2026-05-21, market-adapter.md §9 v2 Extension):
 *  - `fetchOrders(input, credential)` — 마켓 주문 목록 조회 (PRD §6.1).
 *  - `submitTracking(input, credential)` — 송장 번호 제출 (PRD §6.4).
 *  - 두 메서드 모두 `credential` 을 명시 인자로 받는다. authenticate() 후
 *    인스턴스 메모리에 저장된 cred 를 사용하는 v1 패턴과 호환되도록, credential
 *    인자가 들어오면 인자 우선, 없으면 인스턴스 cred fallback 가능 (어댑터별 정책).
 *  - submitTracking 은 throw 대신 discriminated union 반환 — 부분 실패가 정상 흐름.
 *    네트워크 / 인증 / 5xx 같은 횡단 실패만 MarketError throw.
 */
export interface MarketAdapter {
  /** 어댑터 인스턴스가 다루는 마켓 ID. */
  readonly market: MarketId

  /** 어댑터가 사용하는 credential kind. credential_payload jsonb 의 kind 와 1:1. */
  readonly credentialKind: MarketCredentialKind

  /**
   * 4-way 인증 input → 저장 가능한 credential.
   * @throws MarketError('unauthorized' | 'validation' | 'network' | 'server' | 'unknown')
   */
  authenticate(input: AuthInput): Promise<StoredCredential>

  /**
   * refresh_token → token 갱신. OAuth (네이버) 만 사용. 다른 어댑터는 정의 자체 생략(undefined).
   * @throws MarketError('unauthorized') 시 호출측에서 disconnected 처리.
   */
  refreshToken?(refresh: string): Promise<TokenSet>

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

  // ─────────────────────────────────────────────
  // v2 Extension (market-adapter.md §9)
  // ─────────────────────────────────────────────

  /**
   * 마켓 주문 목록 조회.
   * - PRD.md §6.1 매트릭스.
   * - 마켓별 raw status / 페이지네이션은 어댑터 내부에서 흡수, 정규화된 MarketOrder[] 반환.
   * - credential 인자가 명시되면 그 자격증명을 사용. 없으면 authenticate() 후 인스턴스
   *   cred fallback (어댑터별).
   * @throws MarketError('unauthorized' | 'rate_limit' | 'network' | 'server' | 'unknown')
   */
  fetchOrders(
    input: FetchOrdersInput,
    credential?: StoredCredential,
  ): Promise<MarketOrder[]>

  /**
   * 송장 번호 제출 (발송 처리).
   * - PRD.md §6.4 매트릭스.
   * - 정상 마켓 거부(검증 실패 / 이미 발송됨 등)는 `{ ok: false, errorCode, errorMessage }`
   *   반환 — throw 하지 않음 (다중 주문 배치 처리에서 한 건 실패가 흐름을 멈추지 않도록).
   * - 네트워크 / 인증 / 5xx 같은 횡단 실패만 MarketError throw.
   * @throws MarketError('unauthorized' | 'rate_limit' | 'network' | 'server')
   */
  submitTracking(
    input: SubmitTrackingInput,
    credential?: StoredCredential,
  ): Promise<MarketSubmitTrackingResult>
}
