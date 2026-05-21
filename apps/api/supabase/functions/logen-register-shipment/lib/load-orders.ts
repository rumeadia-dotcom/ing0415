/**
 * orders 테이블에서 등록 대상 주문 로드 (service_role).
 *
 * - 본인 셀러 + status = 'collected' 만 (이미 logen_registered 인 건 재처리 차단).
 * - orderIds 검증: 셀러 소유 여부를 WHERE 에 명시. 다른 셀러 row 가 섞이면 무시 (returned < requested).
 */

import { HttpErrors, type Logger } from '../../_shared/index.ts'
import type { getServiceClient } from '../../_shared/supabase.ts'
import type { OrderForRegister } from './types.ts'

type Service = ReturnType<typeof getServiceClient>

export async function loadOrdersForRegister(
  service: Service,
  sellerId: string,
  orderIds: string[],
  logger: Logger,
): Promise<OrderForRegister[]> {
  if (orderIds.length === 0) return []

  const { data, error } = await service
    .from('orders')
    .select(
      'id, receiver_name, receiver_address, receiver_phone, quantity, status, seller_id',
    )
    .eq('seller_id', sellerId)
    .in('id', orderIds)

  if (error) {
    logger.error(
      {
        sellerId,
        requested: orderIds.length,
        rpcError: error.code ?? 'unknown',
      },
      '← load orders error',
    )
    throw HttpErrors.internal('orders_load_failed', 'failed to load orders')
  }

  interface OrderRow {
    id: string
    receiver_name: string
    receiver_address: string
    receiver_phone: string
    quantity: number
    status: string
    seller_id: string
  }
  const rows = (data ?? []) as OrderRow[]

  // 셀러 소유 + collected 상태만. 다른 상태는 멱등성 보장을 위해 제외.
  const eligible = rows.filter(
    (r) => r.seller_id === sellerId && r.status === 'collected',
  )

  logger.info(
    {
      sellerId,
      requested: orderIds.length,
      returned: rows.length,
      eligible: eligible.length,
    },
    'orders eligibility',
  )

  return eligible.map((r) => ({
    id: r.id,
    receiver_name: r.receiver_name,
    receiver_address: r.receiver_address,
    receiver_phone: r.receiver_phone,
    quantity: r.quantity,
  }))
}
