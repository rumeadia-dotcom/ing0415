/**
 * Edge Function: registration-cancel
 *
 * 마스터:
 *   - docs/architecture/v1/features/registration.md §6.6
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §3.5 (RPC), §4.1
 *
 * 책임:
 *   - 셀러가 진행 중 잡 취소. pending / running / retrying 만 cancel.
 *   - 상태 전이는 `rpc_cancel_registration_job(p_job_id)` RPC 호출 (state.md §3.5).
 *     RPC 가 auth.uid() 와 상태 가드를 동시에 검증한다 (RLS + check).
 *   - 협조적 취소: in_flight worker 는 자체 polling 으로 cancelled 감지 후 jmr 갱신
 *     스킵. 본 함수는 RPC 호출 + audit 만.
 *
 * 강제:
 *   - JWT 검증 후 sellerId 확정.
 *   - RPC 가 거부하면 409 already_finalized 응답.
 *   - 응답에 PII 노출 금지. completed_at / cancelled_at 만 노출.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getUserClient,
  HttpErrors,
  ok,
  parseBody,
  requireBearer,
  withRequest,
} from '../_shared/index.ts'

const RequestSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.string().max(200).optional(),
})

interface CancelRpcRow {
  id: string
  status: string
  cancelled_at: string | null
  completed_at: string | null
}

export default Deno.serve(
  withRequest('registration-cancel', async ({ req, logger, correlationId }) => {
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
        event: 'registration_cancel',
        sellerId,
        jobId: body.jobId,
        correlationId,
      },
      '→ registration cancel',
    )

    // RPC 는 security invoker → 셀러 RLS 통과 + 상태 가드 (state.md §3.5).
    // 'cancel_not_allowed' 예외 = 비합법 전이 (이미 종료/취소 등).
    const { data, error } = await userClient.rpc('rpc_cancel_registration_job', {
      p_job_id: body.jobId,
    })

    if (error) {
      const errCode = error.code ?? error.message ?? ''
      const isGuardFailure =
        errCode === 'P0001' || /cancel_not_allowed/i.test(error.message ?? '')

      logger.warn(
        {
          jobId: body.jobId,
          sellerId,
          rpcError: errCode,
          correlationId,
        },
        '← cancel rpc rejected',
      )

      if (isGuardFailure) {
        throw HttpErrors.conflict(
          'already_finalized',
          'job is not in a cancellable state',
        )
      }
      throw HttpErrors.internal('cancel_failed', 'failed to cancel job')
    }

    if (!data) {
      throw HttpErrors.notFound('job_not_found', 'job not found or not owned')
    }

    // RPC 응답 형식 검증 (state.md §3.5 returns registration_jobs)
    const row = (Array.isArray(data) ? data[0] : data) as CancelRpcRow | null
    if (!row || row.status !== 'cancelled') {
      throw HttpErrors.internal('cancel_unexpected', 'unexpected rpc response')
    }

    await appendAudit({
      category: 'registration',
      event: 'registration.cancel',
      sellerId,
      meta: {
        jobId: body.jobId,
        reason: body.reason ?? null,
      },
      correlationId,
      logger,
    })

    return ok(
      {
        jobId: row.id,
        status: 'cancelled' as const,
        cancelledAt: row.cancelled_at ?? new Date().toISOString(),
      },
      { correlationId },
    )
  }),
)
