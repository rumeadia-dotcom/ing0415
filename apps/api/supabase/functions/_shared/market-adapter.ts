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
 *
 * v1 변경 (2026-05-19 Wave 1):
 *   - authenticate(input) — 4-way AuthInput discriminated union.
 *   - 반환 타입 StoredCredential (kind + payload).
 *   - refreshToken 은 optional (OAuth = 네이버 한정).
 */

import type {
  AuthInput,
  CategoryNode,
  CreateProductResult,
  MarketCredentialKind,
  MarketId,
  MarketMapping,
  MarketPayload,
  Product,
  RegistrationFieldMeta,
  StoredCredential,
  TokenSet,
} from './schemas.ts'
import type { FetchOrdersInput, MarketOrder } from './market-orders.ts'

/**
 * 송장 제출 결과 (v2 shipping).
 *
 * Edge 워커(shipping-dispatch-market-worker)는 positional 인자 + throw-on-failure
 * 계약을 사용한다 (Web 의 discriminated-union MarketSubmitTrackingResult 와 다름 —
 * Edge 는 withRetry / 결과 적재를 process.ts 오케스트레이터가 담당하므로 어댑터는
 * 성공 객체만 반환하고 거부는 MarketError throw).
 */
export interface SubmitTrackingResult {
  market: MarketId
  externalOrderId: string
  waybillNumber: string
  carrierCode: string
  /** 마켓 API 가 송장 등록 후 반환하는 식별자 (있는 경우). */
  trackingReceiptId?: string
}

export interface MarketAdapter {
  readonly market: MarketId
  readonly credentialKind: MarketCredentialKind

  authenticate(input: AuthInput): Promise<StoredCredential>
  /**
   * 저장된(복호화된) 자격증명으로 어댑터 in-memory cred 를 복원한다.
   * authenticate(최초 인증/교환)와 분리 — verify / registration 처럼 이미 저장된
   * 자격증명을 쓰는 경로는 fetchCategoryTree / createProduct 호출 전에 hydrate 를
   * 먼저 호출해야 한다. 외부 API 호출 없음. kind 불일치 시 MarketError('validation').
   */
  hydrate(stored: StoredCredential): void
  refreshToken?(refresh: string): Promise<TokenSet>
  fetchCategoryTree(): Promise<CategoryNode[]>
  transformProduct(product: Product, mapping: MarketMapping): MarketPayload
  createProduct(payload: MarketPayload): Promise<CreateProductResult>

  /**
   * 마켓별 동적 등록필드 메타 (s3 3단계 MarketOptionsCard 동적 렌더용).
   * 마스터: docs/architecture/v1/features/esm.md §4.6 / §6, cross-cutting/market-adapter.md.
   *
   * 하위호환: optional + 기본 동작은 빈 배열(`[]`). 미구현(undefined) = 추가 등록필드 없음.
   * naver/coupang/11st 어댑터는 메서드 자체를 생략 → 카테고리 매핑만(현 동작 불변).
   * ESM(gmarket/auction) 어댑터만 배송 프로필 선택 필드를 선언(officialNotice 는 PR-5).
   * 순수 동기 함수 — 외부 호출 없음.
   */
  getRegistrationFields?(): RegistrationFieldMeta[]

  /**
   * 주문 자동 수집 (v2 orders, optional — 마켓별 real 어댑터에서 구현).
   * 저장 자격증명으로 hydrate 후 호출. 마켓 raw status 를 정규화 enum 으로 변환해
   * MarketOrder[] 반환. MarketError throw 만 (재시도/로깅은 orders-sync 오케스트레이터).
   * 미구현 마켓은 메서드 자체 생략 → orders-sync 가 hasFetchOrders 로 스킵.
   */
  fetchOrders?(input: FetchOrdersInput): Promise<MarketOrder[]>

  /**
   * 송장 제출 (v2 shipping, optional — 마켓별 real 어댑터에서 구현).
   * 마켓별 외부 주문 ID + 운송장번호 + 택배사 코드 → 마켓 API 호출.
   * 마켓 거부(검증 실패 / 이미 발송 등) 포함 모든 실패는 MarketError throw.
   * (재시도 / 결과 적재 / 로깅은 호출측 process.ts withRetry 오케스트레이터.)
   */
  submitTracking?(
    externalOrderId: string,
    waybillNumber: string,
    carrierCode: string,
  ): Promise<SubmitTrackingResult>
}
