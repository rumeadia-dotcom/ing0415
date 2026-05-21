/**
 * orders 테이블 upsert 어댑터.
 *
 * 마스터:
 *   - PR2 가 정의할 orders 테이블 (가정 스키마):
 *     id (uuid pk), seller_id (uuid fk), market_id (text), external_order_id (text),
 *     status (text), ordered_at (timestamptz), payload (jsonb),
 *     created_at, updated_at, shipment_status (text default 'pending')
 *   - UNIQUE(seller_id, market_id, external_order_id) — on conflict do nothing 로 중복 방지.
 *
 * 강제:
 *   - service_role 클라이언트만 사용 (RLS bypass — orders 테이블은 셀러 SELECT only).
 *   - 평문 토큰 / PII 절대 적재 금지. payload jsonb 는 마켓 raw 응답만.
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
 * 4 마켓 통합 upsert.
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

  const rows = inputs.map((i) => ({
    seller_id: i.sellerId,
    market_id: i.marketId,
    external_order_id: i.order.externalOrderId,
    status: i.order.status,
    ordered_at: i.order.orderedAt,
    payload: i.order.payload,
  }))

  // ignoreDuplicates: true → conflict row 는 결과에서 제외됨. 신규 insert 만 returning.
  const { data, error } = await supabase
    .from('orders')
    .upsert(rows, {
      onConflict: 'seller_id,market_id,external_order_id',
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
