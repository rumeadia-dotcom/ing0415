import type { MarketDispatchStatus } from '@/lib/schemas/orders'

/**
 * O1: list_orders / get_order RPC 는 market_dispatch_status 를 내부 enum
 * shipping_job_results.status (success | failed) 또는 결과행이 없을 때 null 로 내려준다.
 * UI 도메인(MarketDispatchStatus: pending | submitted | failed)으로 매핑한다.
 *
 *  - null/undefined (미제출) → pending
 *  - success                 → submitted
 *  - failed                  → failed
 *
 * 알 수 없는 값은 안전하게 pending 으로 폴백 — 한 행의 예상치 못한 값이 목록 전체를
 * throw 시키지 않도록 (orders-api 의 mapOrderRow / remapOrderDetail 경계에서 사용).
 */
export function mapDispatchStatus(raw: string | null | undefined): MarketDispatchStatus {
  switch (raw) {
    case 'success':
    case 'submitted':
      return 'submitted'
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}
