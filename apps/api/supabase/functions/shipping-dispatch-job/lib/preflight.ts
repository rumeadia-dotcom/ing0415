/**
 * shipping-dispatch-job preflight:
 *   1) orderIds 가 비면 status='waybill_printed' 전부 로드 (셀러 본인).
 *   2) orderIds 가 명시되면 본인 소유 + status='waybill_printed' 검증.
 *   3) waybill_number / carrier_code 가 채워져 있는지 검증 (없으면 dispatch 불가).
 *   4) 마켓별 그룹화 + market_account 존재 확인.
 *
 * 모두 service_role 경로. seller_id 를 WHERE 절에 명시 강제.
 */

import {
  type getServiceClient,
  HttpErrors,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'
import type { OrderRow } from './types.ts'

type Service = ReturnType<typeof getServiceClient>

export async function loadDispatchableOrders(
  service: Service,
  sellerId: string,
  orderIds: readonly string[] | undefined,
  logger: Logger,
): Promise<OrderRow[]> {
  let query = service
    .from('orders')
    .select(
      'id, seller_id, market_id, market_account_id, external_order_id, status, waybill_number, carrier_code',
    )
    .eq('seller_id', sellerId)
    .eq('status', 'waybill_printed')

  if (orderIds && orderIds.length > 0) {
    query = query.in('id', orderIds as string[])
  }

  const { data, error } = await query

  if (error) {
    logger.error(
      { sellerId, rpcError: error.code ?? 'unknown' },
      '← dispatch orders load error',
    )
    throw HttpErrors.internal('orders_load_failed', 'failed to load orders')
  }

  const rows = (data ?? []) as OrderRow[]

  // orderIds 가 명시됐는데 일부가 누락 = 권한/상태 불일치.
  if (orderIds && orderIds.length > 0) {
    const loaded = new Set(rows.map((r) => r.id))
    const missing = orderIds.filter((id) => !loaded.has(id))
    if (missing.length > 0) {
      throw HttpErrors.badRequest(
        'orders_not_dispatchable',
        `orders not found or not in waybill_printed: ${missing.length}`,
        { missing },
      )
    }
  }

  // waybill_number / carrier_code 필수.
  const incomplete = rows.filter(
    (r) => !r.waybill_number || !r.carrier_code,
  )
  if (incomplete.length > 0) {
    throw HttpErrors.badRequest(
      'waybill_missing',
      'orders missing waybill_number or carrier_code',
      { count: incomplete.length, sample: incomplete.slice(0, 5).map((r) => r.id) },
    )
  }

  return rows
}

/**
 * 마켓별 orderIds 그룹화. Map 으로 반환 (insertion order 보장).
 */
export function groupOrdersByMarket(orders: readonly OrderRow[]): Map<MarketId, string[]> {
  const map = new Map<MarketId, string[]>()
  for (const order of orders) {
    const market = order.market_id as MarketId
    const list = map.get(market)
    if (list) {
      list.push(order.id)
    } else {
      map.set(market, [order.id])
    }
  }
  return map
}
