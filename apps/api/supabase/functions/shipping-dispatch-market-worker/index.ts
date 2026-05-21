/**
 * Edge Function: shipping-dispatch-market-worker
 *
 * 마스터 (의존, 본 PR 범위 외 정의):
 *   - docs/spec/PRD-v2-shipping.md §2.4
 *   - docs/spec/user_flow-v2-shipping.md s8 n53/n54/n55/n56
 *   - PR2: shipping_jobs / shipping_job_results / orders 마이그레이션
 *   - PR4: MarketAdapter.submitTracking 구현
 *
 * 책임:
 *   - shipping-dispatch-job 이 마켓당 1회 fire-and-forget invoke.
 *   - body: { jobId, marketId, orderIds[], correlationId }
 *   - 마켓 안에서 orderIds 를 순회. 각 주문은 격리:
 *       한 주문 실패가 같은 마켓 내 다른 주문 진행을 막지 않음.
 *   - 각 주문 처리 후 recomputeShippingJobStatus 호출 → Realtime push.
 *
 * 인증:
 *   - service_role 만. Authorization 헤더가 service_role JWT 인지 검증.
 *
 * 강제:
 *   - MarketError → shipping error_code 매핑은 lib/error-map.ts 단일 출처.
 *   - attempt_count 3 도달 또는 재시도 불가 코드 → failed_final.
 *   - error_message 는 MarketError.message 만 (raw 응답 적재 금지, 길이 200).
 */

import {
  env,
  getServiceClient,
  HttpErrors,
  parseBody,
  withRequest,
} from '../_shared/index.ts'
import { DispatchMarketWorkerRequestSchema } from '../shipping-dispatch-job/lib/types.ts'
import { loadShippingJobContext } from './lib/data-load.ts'
import { processShippingMarket } from './lib/process.ts'

function requireServiceRole(req: Request): void {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token !== env.SUPABASE_SERVICE_ROLE_KEY) {
    throw HttpErrors.forbidden(
      'service_role_required',
      'worker can only be invoked by service_role',
    )
  }
}

export default Deno.serve(
  withRequest('shipping-dispatch-market-worker', async ({ req, logger, correlationId }) => {
    requireServiceRole(req)
    const body = await parseBody(req, DispatchMarketWorkerRequestSchema)
    const service = getServiceClient()

    const jobCtx = await loadShippingJobContext(service, body.jobId, logger)

    const summary = await processShippingMarket(
      {
        jobId: body.jobId,
        sellerId: jobCtx.sellerId,
        marketId: body.marketId,
        orderIds: body.orderIds,
        correlationId: body.correlationId,
      },
      service,
      logger,
    )

    // 응답은 디버깅용 — 호출측 (job) 은 await 안 함 (fire-and-forget).
    return new Response(
      JSON.stringify({
        jobId: body.jobId,
        marketId: body.marketId,
        ...summary,
        correlationId,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    )
  }),
)
