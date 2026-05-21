/**
 * orders 테이블 upsert 어댑터.
 *
 * 마스터:
 *   - PRD-v2-shipping.md §4 (orders 테이블 스키마 — ground truth)
 *   - PR2 마이그레이션 (orders 테이블 + UNIQUE 제약)
 *
 * PRD §4 컬럼 매핑 (어댑터 MarketOrder → orders row):
 *   externalOrderId    → external_order_id
 *   buyerName          → buyer_name
 *   receiverName       → receiver_name
 *   receiverAddress    → receiver_address
 *   receiverPhone      → receiver_phone
 *   productName        → product_name
 *   quantity           → quantity
 *   orderAmount        → order_amount
 *   status (정규화)    → status (DB enum: 'collected' 고정 — 수집 시점)
 *   paidAt             → collected_at  (PRD §4 의 timestamp 컬럼)
 *   market             → market_id
 *   (seller_id 는 별도 인자)
 *
 * 상태 매핑 근거:
 *   - 어댑터의 정규화 status `new_pay` 는 "결제 완료, 발송 대기" — 본 PR 의 폴링 대상.
 *   - DB orders.status 는 PRD §4 의 영문 ENUM (collected | logen_registered | ...).
 *     수집 시점에는 무조건 `'collected'` (이후 PR6 가 `logen_registered` 로 전이).
 *   - 어댑터가 `new_pay` 가 아닌 다른 status 를 반환하면 (이론상 발생 안 하지만 방어적)
 *     upsert 에서 제외 — 부적격 상태 적재 차단.
 *
 * UNIQUE 제약: (market_id, external_order_id, seller_id) — PRD §4.
 *
 * 강제:
 *   - service_role 클라이언트만 사용 (RLS bypass — orders 는 셀러 SELECT only).
 *   - 평문 PII (buyer / receiver) 는 DB 컬럼에는 적재되지만 로그·에러에는 노출 금지.
 *   - 새로 insert 된 row 의 id 만 반환 — logen-register-shipment 위임 대상.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { HttpErrors } from '../../_shared/index.ts'
import type { Logger, MarketId } from '../../_shared/index.ts'
import type { MarketOrder } from './adapter-shape.ts'

export interface UpsertOrderInput {
  sellerId: string
  marketId: MarketId
  order: MarketOrder
}

export interface UpsertOrderResult {
  /** insert 된 orders.id. 기존 row 면 null. */
  insertedId: string | null
  externalOrderId: string
}

/**
 * orders 테이블 upsert (PRD §4 컬럼 정합).
 *
 * supabase-js 의 .upsert({...}, { onConflict: '...', ignoreDuplicates: true })
 * 는 중복 row 일 때 returning row 가 비어 있음 — 그것으로 신규/중복 판별.
 */
export async function upsertOrders(
  supabase: SupabaseClient,
  inputs: UpsertOrderInput[],
  logger: Logger,
): Promise<UpsertOrderResult[]> {
  if (inputs.length === 0) return []

  // 정규화 status 가 'new_pay' 인 주문만 적재 (PRD §2.1 결제완료/배송대기).
  // 그 외 status 가 흘러들어오면 적재 제외 — 부적격 row 차단.
  const eligible = inputs.filter((i) => i.order.status === 'new_pay')

  if (eligible.length < inputs.length) {
    logger.warn(
      {
        total: inputs.length,
        eligible: eligible.length,
        dropped: inputs.length - eligible.length,
      },
      '← orders upsert: non-new_pay status filtered',
    )
  }

  if (eligible.length === 0) {
    return inputs.map((i) => ({
      insertedId: null,
      externalOrderId: i.order.externalOrderId,
    }))
  }

  const rows = eligible.map((i) => ({
    seller_id: i.sellerId,
    market_id: i.marketId,
    external_order_id: i.order.externalOrderId,
    buyer_name: i.order.buyerName,
    receiver_name: i.order.receiverName,
    receiver_address: i.order.receiverAddress,
    receiver_phone: i.order.receiverPhone,
    product_name: i.order.productName,
    quantity: i.order.quantity,
    order_amount: i.order.orderAmount,
    status: 'collected' as const,
    collected_at: i.order.paidAt,
  }))

  // ignoreDuplicates: true → conflict row 는 결과에서 제외됨. 신규 insert 만 returning.
  const { data, error } = await supabase
    .from('orders')
    .upsert(rows, {
      onConflict: 'market_id,external_order_id,seller_id',
      ignoreDuplicates: true,
    })
    .select('id, market_id, external_order_id')

  if (error) {
    logger.error(
      {
        rpcError: error.code ?? 'unknown',
        rpcMessage: error.message,
        rowCount: rows.length,
      },
      '← orders upsert error',
    )
    throw HttpErrors.internal('orders_upsert_failed', 'failed to upsert orders')
  }

  const insertedKey = new Map<string, string>()
  for (const row of data ?? []) {
    const key = `${row.market_id}::${row.external_order_id}`
    insertedKey.set(key, row.id as string)
  }

  return inputs.map((i) => {
    const key = `${i.marketId}::${i.order.externalOrderId}`
    return {
      insertedId: insertedKey.get(key) ?? null,
      externalOrderId: i.order.externalOrderId,
    }
  })
}
