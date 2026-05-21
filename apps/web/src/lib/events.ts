import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

/**
 * v2 KPI 이벤트 트래커.
 *
 * 마스터: docs/spec/PRD.md §1.5 (핵심 지표)
 *
 * - v1 `events` 테이블에 본 v2 이벤트 코드를 추가한다 (스키마 변경 없이 enum 키 확장).
 * - **자동 발화 (Edge Function 책임)** vs **수동 발화 (FE 액션 책임)** 분리:
 *
 *   | 이벤트 | 자동 트리거 (Edge) | FE 보조 발화 시점 |
 *   |---|---|---|
 *   | `orders.collected` | `orders-sync` 폴링 직후 | 수동 동기화 버튼 |
 *   | `orders.logen_registered` | `logen-register-shipment` 성공 | (없음) |
 *   | `orders.waybill_printed` | (없음) | 운송장 출력 완료 클릭 (n52) |
 *   | `orders.tracking_submitted` | `shipping-dispatch-job` 성공 | "송장 일괄 제출" 클릭 시작 시점 |
 *
 * - 본 모듈은 **fire-and-forget** — 실패해도 사용자 흐름 차단 금지 (trackAuthEvent 패턴 동일).
 * - 토큰·셀러 이메일·전화번호·자격증명은 절대 meta 에 포함 금지. internal id 만.
 */

export type ShippingEventName =
  | 'orders.collected'
  | 'orders.logen_registered'
  | 'orders.waybill_printed'
  | 'orders.tracking_submitted'

export interface TrackShippingEventInput {
  event: ShippingEventName
  /**
   * 추가 컨텍스트 — orderIds (UUID 배열), jobId, marketIds 등. PII 금지.
   * 카운트 위주 메트릭이므로 일반적으로 `{ count: 3 }` 또는 `{ jobId: '...' }` 정도.
   */
  meta?: Record<string, unknown>
}

/**
 * 배송/주문 도메인 KPI 이벤트를 audit log 에 적재한다.
 *
 * **Fire-and-forget** — await 없이 호출해도 안전 (`void trackShippingEvent(...)`).
 * 예외는 내부에서 swallow.
 */
export async function trackShippingEvent(input: TrackShippingEventInput): Promise<void> {
  const meta = input.meta ?? {}
  try {
    const supabase = getSupabase()
    const { error } = await supabase.functions.invoke('shipping-event-log', {
      body: { event: input.event, meta },
    })
    if (error) {
      logger.warn(
        { event: input.event, err: error.message },
        'shipping-event-log invoke failed',
      )
      return
    }
    logger.debug({ event: input.event }, 'shipping event logged')
  } catch (e) {
    logger.warn(
      { event: input.event, err: e instanceof Error ? e.message : String(e) },
      'shipping-event-log threw',
    )
  }
}
