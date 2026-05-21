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
  StoredCredential,
  TokenSet,
} from './schemas.ts'

/**
 * 송장 제출 결과 (v2 shipping).
 *
 * 마스터: PR4 (MarketAdapter.submitTracking 구현) 시점에 본 타입 zod 미러 추가 예정.
 * 본 PR 에서는 인터페이스 시그니처만 고정.
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
  refreshToken?(refresh: string): Promise<TokenSet>
  fetchCategoryTree(): Promise<CategoryNode[]>
  transformProduct(product: Product, mapping: MarketMapping): MarketPayload
  createProduct(payload: MarketPayload): Promise<CreateProductResult>

  /**
   * 송장 제출 (v2 shipping, optional — PR4 에서 구현).
   * 마켓별 외부 주문 ID + 운송장번호 + 택배사 코드 → 마켓 API 호출.
   * MarketError throw 만. (재시도 / 로깅은 호출측 withRetry.)
   */
  submitTracking?(
    externalOrderId: string,
    waybillNumber: string,
    carrierCode: string,
  ): Promise<SubmitTrackingResult>
}
