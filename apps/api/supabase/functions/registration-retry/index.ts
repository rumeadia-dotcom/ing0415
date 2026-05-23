/**
 * Edge Function: registration-retry
 *
 * 마스터:
 *   - docs/architecture/v1/features/registration.md §6.5
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §4.1, §6
 *
 * 책임:
 *   - Step 5 "재시도" 버튼. 잡 단위 retry_count++ + 상태 retrying.
 *   - 대상 jmr: market_status='failed' 또는 failed_final 중 사용자가 지정한 것.
 *     단, failed_final 은 422 거부 (재시도 불가 코드). 본 함수는 'failed' 만 재시도.
 *   - 각 대상 jmr 의 attempt_count 는 유지(누적). worker 재 invoke 시 ++.
 *
 * 강제:
 *   - ownership 검증 (RLS + 명시 WHERE).
 *   - retry_count 한도 5 초과 시 429.
 *   - cancel 된 잡 거부.
 *   - 응답은 재시도 큐에 들어간 jmr 목록.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  invokeMarketWorker,
  ok,
  parseBody,
  requireBearer,
  withRequest,
  type MarketId,
} from '../_shared/index.ts'

const RequestSchema = z.object({
  jobId: z.string().uuid(),
  marketResultIds: z.array(z.string().uuid()).optional(),
})

interface JmrRetryTarget {
  id: string
  market_id: string
  market_status: string
  attempt_count: number
}

export default Deno.serve(
  withRequest('registration-retry', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const body = await parseBody(req, RequestSchema)

    const userClient = getUserClient(jwt)
    const userRes = await userClient.auth.getUser()
    if (userRes.error || !userRes.data.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userRes.data.user.id

    logger.info(
      {
        event: 'registration_retry',
        sellerId,
        jobId: body.jobId,
        marketResultIds: body.marketResultIds ?? null,
        correlationId,
      },
      '→ registration retry',
    )

    const service = getServiceClient()

    // 잡 ownership + 상태 검증
    const jobRes = await service
      .from('registration_jobs')
      .select('id, seller_id, status, retry_count')
      .eq('id', body.jobId)
      .eq('seller_id', sellerId)
      .maybeSingle()
    if (jobRes.error) {
      throw HttpErrors.internal('job_load_failed', 'failed to load job')
    }
    if (!jobRes.data) {
      throw HttpErrors.notFound('job_not_found', 'job not found')
    }
    const currentStatus = String(jobRes.data.status)
    const retryCount = Number(jobRes.data.retry_count ?? 0)

    if (currentStatus === 'cancelled' || currentStatus === 'succeeded') {
      throw HttpErrors.conflict(
        'job_not_retryable',
        `job status '${currentStatus}' is terminal`,
      )
    }
    if (retryCount >= 5) {
      throw HttpErrors.badRequest(
        'retry_exceeded',
        'retry limit exceeded (max 5)',
        { retryCount },
      )
    }
    if (currentStatus !== 'partial' && currentStatus !== 'failed') {
      // running / retrying / pending 은 이미 진행 중. 재시도 무의미.
      throw HttpErrors.conflict(
        'job_not_retryable',
        `cannot retry while status='${currentStatus}'`,
      )
    }

    // 대상 jmr 조회: 'failed' (non-final) 만. failed_final 은 거부.
    const baseQuery = service
      .from('registration_job_market_results')
      .select('id, market_id, market_status, attempt_count')
      .eq('job_id', body.jobId)

    const jmrRes = body.marketResultIds && body.marketResultIds.length > 0
      ? await baseQuery.in('id', body.marketResultIds)
      : await baseQuery.eq('market_status', 'failed')

    if (jmrRes.error) {
      logger.error(
        { jobId: body.jobId, rpcError: jmrRes.error.code ?? 'unknown' },
        '← retry jmr load error',
      )
      throw HttpErrors.internal('jmr_load_failed', 'failed to load market results')
    }

    const candidates: JmrRetryTarget[] = (jmrRes.data ?? []).map((row) => ({
      id: String(row.id),
      market_id: String(row.market_id),
      market_status: String(row.market_status),
      attempt_count:
        typeof row.attempt_count === 'number' ? row.attempt_count : 0,
    }))

    // failed_final 은 재시도 거부 (state.md §6.2 — 재시도 불가 코드).
    const finals = candidates.filter((c) => c.market_status === 'failed_final')
    if (finals.length > 0 && body.marketResultIds) {
      throw HttpErrors.badRequest(
        'not_retryable',
        'some targets are failed_final',
        { finals: finals.map((f) => f.id) },
      )
    }

    const targets = candidates.filter((c) => c.market_status === 'failed')
    if (targets.length === 0) {
      throw HttpErrors.badRequest(
        'no_retry_targets',
        'no failed market results to retry',
      )
    }

    // 잡 상태 retrying 으로 전이 (state.md §4: partial|failed → retrying).
    // fn_registration_job_transition 이 단일 source of truth (race 가드 + 합법성 체크 포함).
    const { error: transitionErr } = await service.rpc(
      'fn_registration_job_transition',
      { p_job_id: body.jobId, p_to_status: 'retrying', p_actor: 'system' },
    )
    if (transitionErr) {
      logger.error(
        {
          jobId: body.jobId,
          to: 'retrying',
          code: transitionErr.code ?? 'unknown',
          msg: transitionErr.message,
        },
        '← job transition to retrying failed',
      )
      // illegal_transition (P0001) 은 race (이미 다른 요청이 전이) — 클라이언트에 conflict.
      // 그 외는 internal.
      if (transitionErr.code === 'P0001') {
        throw HttpErrors.conflict(
          'job_not_retryable',
          'job already transitioned by another request',
        )
      }
      throw HttpErrors.internal('job_transition_failed', 'failed to set retrying')
    }

    // retry_count++ 는 RPC 외부 책임 (state.md §6.1, fn 주석 — "retry_count 호출측 책임").
    // 위 전이로 이미 status='retrying' 이므로 race 가드는 (id + seller_id) 로 충분.
    const retryCountRes = await service
      .from('registration_jobs')
      .update({ retry_count: retryCount + 1 })
      .eq('id', body.jobId)
      .eq('seller_id', sellerId)
    if (retryCountRes.error) {
      logger.error(
        { jobId: body.jobId, rpcError: retryCountRes.error.code ?? 'unknown' },
        '← retry_count increment failed',
      )
      throw HttpErrors.internal('job_transition_failed', 'failed to increment retry_count')
    }

    // 대상 jmr 을 pending 으로 reset
    const resetRes = await service
      .from('registration_job_market_results')
      .update({
        market_status: 'pending',
        error_code: null,
        error_message: null,
      })
      .in(
        'id',
        targets.map((t) => t.id),
      )
    if (resetRes.error) {
      throw HttpErrors.internal('jmr_reset_failed', 'failed to reset jmr to pending')
    }

    await appendAudit({
      category: 'registration',
      event: 'registration.retry',
      sellerId,
      meta: {
        jobId: body.jobId,
        retried: targets.map((t) => ({ id: t.id, marketId: t.market_id })),
        retryCount: retryCount + 1,
      },
      correlationId,
      logger,
    })

    // worker fan-out (fire-and-forget)
    for (const t of targets) {
      invokeMarketWorker({
        jobId: body.jobId,
        marketId: t.market_id as MarketId,
        marketResultId: t.id,
        correlationId,
        logger,
      })
    }

    return ok(
      {
        jobId: body.jobId,
        status: 'retrying' as const,
        retried: targets.map((t) => ({
          marketResultId: t.id,
          marketId: t.market_id,
        })),
      },
      { correlationId },
    )
  }),
)
