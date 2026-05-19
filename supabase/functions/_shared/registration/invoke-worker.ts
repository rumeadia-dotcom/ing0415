/**
 * registration-market-worker 인보크 (fire-and-forget).
 *
 * - registration-start / registration-retry 양쪽에서 사용.
 * - service_role JWT 부착. 외부 직접 호출 차단 (worker 가 requireServiceRole 로 검증).
 * - await 안 함 → 호출 함수의 timeout 회피. 실패는 로그로만 남김.
 */

import { env } from '../env.ts'
import type { Logger } from '../logger.ts'
import type { MarketId } from '../schemas.ts'

export function invokeMarketWorker(args: {
  jobId: string
  marketId: MarketId
  marketResultId: string
  correlationId: string
  logger: Logger
}): void {
  const url = `${env.SUPABASE_URL}/functions/v1/registration-market-worker`
  const body = JSON.stringify({
    jobId: args.jobId,
    marketId: args.marketId,
    marketResultId: args.marketResultId,
    attempt: 1,
    correlationId: args.correlationId,
  })

  // fire-and-forget. 호출측 timeout 영향 없음.
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
        marketResultId: args.marketResultId,
        correlationId: args.correlationId,
        err: e instanceof Error ? e.message : 'unknown',
      },
      '← worker invoke fire-and-forget failed',
    )
  })

  args.logger.info(
    {
      jobId: args.jobId,
      market: args.marketId,
      marketResultId: args.marketResultId,
      correlationId: args.correlationId,
    },
    '→ worker invoke',
  )
}
