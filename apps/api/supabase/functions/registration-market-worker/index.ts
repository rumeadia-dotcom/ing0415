/**
 * Edge Function: registration-market-worker
 *
 * 마스터:
 *   - docs/architecture/v1/features/registration.md §6.4
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §6.2.1 (error_code 매핑)
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §5 (withRetry)
 *
 * 책임:
 *   - 단일 마켓 단위 처리. registration-start / registration-retry 가 마켓당 1회 fire-and-forget invoke.
 *   - 흐름: ownership 검증 → processMarket (jmr in_flight + adapter call) → handleSuccess/handleFailure.
 *   - 한 마켓 worker 실패가 다른 마켓에 영향 없음. job status 는 recomputeJobStatus 가 단일 결정자.
 *
 * 인증:
 *   - service_role 진입. Authorization 헤더가 service_role JWT 인지 검증 (외부 직접 호출 차단).
 *   - seller_id 는 registration_jobs.seller_id 에서 도출. 모든 WHERE 에 명시.
 *
 * 강제:
 *   - MarketError.code → jmr.error_code 매핑은 state.md §6.2.1 표 (lib/error-map.ts 단일 출처).
 *   - oauth_expired 는 refreshToken 1회 시도 후 실패 시 oauth_revoked 로 분기 (lib/process.ts).
 *   - attempt_count 3 도달 또는 재시도 불가 코드 → failed_final (lib/finalize.ts).
 *   - error_message 는 MarketError.message 만 사용 (raw 응답 적재 금지).
 */

import { z } from 'npm:zod@3.23.8'
import {
  env,
  getServiceClient,
  HttpErrors,
  MarketIdSchema,
  parseBody,
  withRequest,
} from '../_shared/index.ts'
import { loadJobContext } from './lib/data-load.ts'
import { handleFailure, handleSuccess } from './lib/finalize.ts'
import { processMarket } from './lib/process.ts'

const RequestSchema = z.object({
  jobId: z.string().uuid(),
  marketId: MarketIdSchema,
  marketResultId: z.string().uuid(),
  attempt: z.number().int().min(1).max(3),
  correlationId: z.string().min(8),
})

/**
 * Edge Function 간 호출 검증: registration-start / registration-retry 가
 * service_role JWT 로 호출한다. 외부 직접 호출 차단.
 */
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
  withRequest('registration-market-worker', async ({ req, logger }) => {
    requireServiceRole(req)
    const body = await parseBody(req, RequestSchema)
    const service = getServiceClient()

    const jobCtx = await loadJobContext(service, body.jobId, logger)

    const input = {
      jobId: body.jobId,
      marketId: body.marketId,
      marketResultId: body.marketResultId,
      correlationId: body.correlationId,
    }

    try {
      const result = await processMarket(input, jobCtx, service, logger)
      return await handleSuccess({ service, input, jobCtx, result, logger })
    } catch (err) {
      return await handleFailure({
        service,
        input,
        jobCtx,
        err,
        fallbackAttempt: body.attempt,
        logger,
      })
    }
  }),
)
