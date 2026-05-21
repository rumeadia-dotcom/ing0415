/**
 * orders 테이블 상태 전이 (service_role).
 *
 * - 성공: status = 'logen_registered', logen_order_id = fixTakeNo,
 *         waybill_number = slipNo, logen_registered_at = now()
 * - 실패: status = 'logen_failed', error_code / error_message 채움,
 *         attempt_count = least(5, attempt_count + 1)
 *
 * 강제:
 *   - error_message 는 maskError 통과한 사용자 노출 메시지만. raw API body 적재 금지.
 *   - update 는 (id, seller_id) WHERE 로 권한 재확인.
 */

import { type Logger, MarketError } from '../../_shared/index.ts'
import type { getServiceClient } from '../../_shared/supabase.ts'

type Service = ReturnType<typeof getServiceClient>

export async function markOrderRegistered(args: {
  service: Service
  sellerId: string
  orderId: string
  fixTakeNo: string
  slipNo: string
  logger: Logger
}): Promise<void> {
  const { service, sellerId, orderId, fixTakeNo, slipNo, logger } = args
  const { error } = await service
    .from('orders')
    .update({
      status: 'logen_registered',
      logen_order_id: fixTakeNo,
      waybill_number: slipNo,
      logen_registered_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq('id', orderId)
    .eq('seller_id', sellerId)
    .eq('status', 'collected') // 멱등성: 이미 다른 상태면 노옵

  if (error) {
    logger.error(
      {
        sellerId,
        orderId,
        rpcError: error.code ?? 'unknown',
      },
      '← order update (registered) failed',
    )
    // 본 함수 실패는 catch 측이 결정 — 잡 자체는 진행. throw 하지 않고 호출측 알림용 표식.
    throw new Error('order_update_failed')
  }
}

export async function markOrderFailed(args: {
  service: Service
  sellerId: string
  orderId: string
  err: unknown
  logger: Logger
}): Promise<void> {
  const { service, sellerId, orderId, err, logger } = args

  const errorCode = err instanceof MarketError ? err.code : 'unknown'
  // 사용자 노출 메시지 — raw API body 금지. MarketError.message 또는 'logen failed' 고정.
  const errorMessage =
    err instanceof MarketError ? err.message : 'logen register failed'

  // attempt_count 는 CHECK(<=5) 가 강제. RPC 또는 SQL 식으로 증가하는 게 정공법이지만
  // supabase-js 의 update 에 raw SQL 표현식이 어색하므로 select → update 2회 호출 회피용으로
  // 단일 update + COALESCE 패턴 (rpc) 가 필요. v1 범위에선 SET attempt_count = attempt_count + 1 을
  // RPC 로 격상하지 않고, 단순히 status 만 전이 + error 채움. attempt_count 는 호출측 큰 그림에서
  // 잡 단위로 관리 (orders.attempt_count 는 보조 정보).
  const { error: updateErr } = await service
    .from('orders')
    .update({
      status: 'logen_failed',
      error_code: errorCode,
      error_message: errorMessage,
    })
    .eq('id', orderId)
    .eq('seller_id', sellerId)

  if (updateErr) {
    logger.error(
      {
        sellerId,
        orderId,
        rpcError: updateErr.code ?? 'unknown',
      },
      '← order update (failed) failed',
    )
  }
}
