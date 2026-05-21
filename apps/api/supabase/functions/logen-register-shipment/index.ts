/**
 * Edge Function: logen-register-shipment
 *
 * 마스터:
 *   - docs/spec/PRD.md §6.2 (전체 처리 순서)
 *   - docs/spec/user_flow.md s8 n51 (자동 등록 흐름) / n50 (실패 시 수동 처리 유도)
 *
 * 책임:
 *   - 수집된 주문(status='collected')에 대해 로젠 집하 예약 등록 + 운송장번호 채번.
 *   - 흐름: 자격증명 복호 → getSlipNo(slipQty=N) → registerOrderData × N (fan-out, allSettled)
 *     → DB 전이 (logen_registered / logen_failed).
 *   - 한 주문 실패가 다른 주문 진행을 막지 않음.
 *
 * 인증:
 *   - service_role 진입. orders-sync (Edge Function 간 invoke) 또는 운영자의 수동 트리거.
 *   - 외부 직접 호출 차단 — Authorization 헤더가 SUPABASE_SERVICE_ROLE_KEY 인지 검증.
 *
 * 강제:
 *   - 재시도 정책: getSlipNo / registerOrderData 각 3회 (1s, 4s, 9s 지수 백오프).
 *   - MarketError.retryable 만 재시도 (rate_limit / server / network).
 *   - unauthorized / validation 은 즉시 logen_failed 진입 → n50 수동 처리 다이얼로그 유도.
 *   - 자격증명 평문(userId / custCd) 로그 노출 금지. 길이만.
 */

import { z } from 'npm:zod@3.23.8'
import {
  env,
  getServiceClient,
  HttpErrors,
  ok,
  parseBody,
  withRequest,
} from '../_shared/index.ts'
import { createLogenClient } from './lib/client.ts'
import { processRegistration } from './lib/process.ts'

const RequestSchema = z.object({
  sellerId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1).max(200),
})

function requireServiceRole(req: Request): void {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    throw HttpErrors.unauthorized('missing_token', 'Authorization required')
  }
  const token = auth.slice('bearer '.length).trim()
  if (token !== env.SUPABASE_SERVICE_ROLE_KEY) {
    throw HttpErrors.forbidden(
      'service_role_required',
      'logen-register-shipment can only be invoked by service_role',
    )
  }
}

export default Deno.serve(
  withRequest('logen-register-shipment', async ({ req, logger, correlationId }) => {
    requireServiceRole(req)
    const body = await parseBody(req, RequestSchema)
    const service = getServiceClient()

    const client = createLogenClient({ logger, correlationId })

    logger.info(
      {
        sellerId: body.sellerId,
        orderCount: body.orderIds.length,
        correlationId,
      },
      '→ logen register start',
    )

    const result = await processRegistration({
      service,
      sellerId: body.sellerId,
      orderIds: body.orderIds,
      client,
      correlationId,
      logger,
    })

    logger.info(
      {
        sellerId: body.sellerId,
        registered: result.registered,
        failed: result.failed,
        skipped: result.skipped,
        correlationId,
      },
      '← logen register done',
    )

    return ok(result, { correlationId })
  }),
)
