import { z } from 'zod'
import { MarketIdSchema } from './common'

/**
 * MarketAdapter v2 확장 — 주문 조회·송장 제출 zod 스키마.
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9 (v2 Extension)
 *   - PRD-v2-shipping.md §2.1 (주문 조회), §2.4 (송장 제출)
 *
 * 본 파일은 v2 어댑터의 입출력 타입을 정의한다.
 *  - fetchOrders → `MarketOrder[]`
 *  - submitTracking → `MarketSubmitTrackingResult` (성공/실패 discriminated union)
 *
 * 호출측(Edge Function `orders-sync` / `shipping-dispatch-job`)이 동일 zod 로 parse.
 */

// ─────────────────────────────────────────────
// FetchOrdersInput — fetchOrders 의 입력
// ─────────────────────────────────────────────

/**
 * 마켓 주문 상태 — 마켓별 raw status 가 다양하지만, 어댑터가 다음 표준값으로 정규화한다.
 *   - new_pay        : 결제 완료, 발송 대기 (네이버 NEW_PAY_WAITING / 쿠팡 ACCEPT 등 매핑)
 *   - dispatched     : 발송 처리 완료 (운송장 제출됨)
 *   - delivering     : 배송중
 *   - delivered      : 배송 완료
 *   - cancelled      : 취소
 *   - returned       : 반품
 *   - unknown        : 매핑되지 않은 raw status (raw 만 보존)
 */
export const MarketOrderStatusSchema = z.enum([
  'new_pay',
  'dispatched',
  'delivering',
  'delivered',
  'cancelled',
  'returned',
  'unknown',
])
export type MarketOrderStatus = z.infer<typeof MarketOrderStatusSchema>

export const FetchOrdersInputSchema = z.object({
  /** 셀러 UUID (도메인 식별자). 로그·correlation 용. 외부 마켓 API 에 직접 전달 X. */
  sellerId: z.string().uuid(),
  /** ISO 8601 + offset. 조회 시작 시각 (paidAt 기준). 어댑터는 마켓별 파라미터로 변환. */
  since: z.string().datetime({ offset: true }).optional(),
  /** ISO 8601 + offset. 조회 종료 시각. */
  until: z.string().datetime({ offset: true }).optional(),
  /** 정규화된 status 필터. 비어있으면 마켓별 기본값 (= 발송 대기). */
  statuses: z.array(MarketOrderStatusSchema).optional(),
})
export type FetchOrdersInput = z.infer<typeof FetchOrdersInputSchema>

// ─────────────────────────────────────────────
// MarketOrder — fetchOrders 반환 항목
//
// PRD-v2-shipping.md §2.1 매트릭스 기준 최소 공통 필드:
//   - externalOrderId : 마켓 고유 주문 ID (송장 제출 시 path/body 키로 재사용)
//   - buyerName       : 구매자 명
//   - receiverName    : 수령인 명
//   - receiverAddress : 수령지 주소 (한 줄)
//   - receiverPhone   : 수령인 연락처 (마스킹 전 raw)
//   - productName     : 상품명 (마켓별 itemName / productName 정규화)
//   - quantity        : 수량
//   - orderAmount     : 주문 총액 (원, 정수)
//   - status          : MarketOrderStatusSchema 정규화 값
//   - paidAt          : 결제 완료 시각 ISO 8601 + offset
//
// 주의: receiverPhone / buyerName / receiverAddress 는 PII. 로그에 절대 직접 출력 금지.
//   logger 의 redact() (security.md §6.2) 가 키 이름 기반 마스킹.
// ─────────────────────────────────────────────
export const MarketOrderSchema = z.object({
  externalOrderId: z.string().min(1),
  buyerName: z.string().min(1),
  receiverName: z.string().min(1),
  receiverAddress: z.string().min(1),
  receiverPhone: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  orderAmount: z.number().int().nonnegative(),
  status: MarketOrderStatusSchema,
  paidAt: z.string().datetime({ offset: true }),
  /** 마켓 ID — 호출측에서 어댑터 컨텍스트와 교차 검증. */
  market: MarketIdSchema,
})
export type MarketOrder = z.infer<typeof MarketOrderSchema>

// ─────────────────────────────────────────────
// SubmitTrackingInput — submitTracking 의 입력
//
// carrierCode 는 v2 MVP 에서 'LOGEN' 단일 (로젠택배). 추후 확장.
// ─────────────────────────────────────────────
export const TRACKING_CARRIER_CODES = ['LOGEN'] as const
export const TrackingCarrierCodeSchema = z.enum(TRACKING_CARRIER_CODES)
export type TrackingCarrierCode = z.infer<typeof TrackingCarrierCodeSchema>

export const SubmitTrackingInputSchema = z.object({
  externalOrderId: z.string().min(1),
  waybillNumber: z.string().min(1).max(40),
  carrierCode: TrackingCarrierCodeSchema,
})
export type SubmitTrackingInput = z.infer<typeof SubmitTrackingInputSchema>

// ─────────────────────────────────────────────
// MarketSubmitTrackingResult — submitTracking 반환
//
// 어댑터는 성공/실패를 **throw 가 아닌 discriminated union 반환** 으로 전달한다.
// 이유: 한 잡(shipping-dispatch-job)이 다중 주문 처리 시 한 건 실패가 다른 건을
// 멈추지 않도록, 부분 실패가 정상 흐름의 일부. throw 는 네트워크 / 인증 / 5xx 같은
// 횡단 실패에만 (registration-job-state.md §3 — partial success 패턴 동일).
// ─────────────────────────────────────────────
export const MarketSubmitTrackingResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    /** 마켓이 반환한 dispatch / shipment ID (있으면 보존, 없으면 빈 문자열). */
    dispatchId: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    /** 마켓 에러 코드 (마켓 API 가 준 코드 또는 어댑터 표준 코드). */
    errorCode: z.string().min(1),
    /** 사용자 노출 가능한 한국어 메시지 (또는 마켓이 준 메시지). */
    errorMessage: z.string().min(1),
  }),
])
export type MarketSubmitTrackingResult = z.infer<
  typeof MarketSubmitTrackingResultSchema
>
