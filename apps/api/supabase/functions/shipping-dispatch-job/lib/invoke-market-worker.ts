/**
 * shipping-dispatch-market-worker 인보크 (fire-and-forget).
 *
 * - shipping-dispatch-job 이 마켓별로 1회 호출.
 * - service_role JWT 부착. 외부 직접 호출 차단 (worker 가 requireServiceRole 로 검증).
 * - await 안 함 → 부모 잡의 timeout 회피. 실패는 로그로만 남김.
 */

import { env } from '../../_shared/env.ts'
import type { Logger } from '../../_shared/logger.ts'
import type { MarketId } from '../../_shared/schemas.ts'

export function invokeShippingMarketWorker(args: {
  jobId: string
  marketId: MarketId
  orderIds: string[]
  correlationId: string
  logger: Logger
}): void {
  const url = `${env.SUPABASE_URL}/functions/v1/shipping-dispatch-market-worker`
  const body = JSON.stringify({
    jobId: args.jobId,
    marketId: args.marketId,
    orderIds: args.orderIds,
    correlationId: args.correlationId,
  })

  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'x-correlation-id': args.correlationId,
    },
    body,
  }).catch((e: unknown) => {
    args.logger.error(
      {
        jobId: args.jobId,
        market: args.marketId,
        orderCount: args.orderIds.length,
        correlationId: args.correlationId,
        err: e instanceof Error ? e.message : 'unknown',
      },
      '← shipping worker invoke fire-and-forget failed',
    )
  })

  args.logger.info(
    {
      jobId: args.jobId,
      market: args.marketId,
      orderCount: args.orderIds.length,
      correlationId: args.correlationId,
    },
    '→ shipping worker invoke',
  )
}
