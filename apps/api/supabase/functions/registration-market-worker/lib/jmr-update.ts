/**
 * jmr UPDATE / 잡 상태 재계산 helper.
 *
 * - state.md §10.3 decideTerminalStatus 와 동등 로직을 TS 로 구현.
 * - RPC `recompute_job_status` 가 마이그레이션에 추가되면 본 함수를 RPC 호출로 교체 가능.
 */

import {
  type getServiceClient,
  HttpErrors,
  type JobMarketErrorCode,
  type Logger,
} from '../../_shared/index.ts'

type Service = ReturnType<typeof getServiceClient>

export async function markJmrInFlight(
  service: Service,
  marketResultId: string,
  newAttemptCount: number,
): Promise<void> {
  const { error } = await service
    .from('registration_job_market_results')
    .update({
      market_status: 'in_flight',
      attempt_count: newAttemptCount,
      last_attempted_at: new Date().toISOString(),
    })
    .eq('id', marketResultId)
  if (error) {
    throw HttpErrors.internal('jmr_update_failed', 'failed to mark in_flight')
  }
}

export async function updateJmrSuccess(
  service: Service,
  marketResultId: string,
  externalId: string,
  productUrl: string,
  attemptCount: number,
): Promise<void> {
  const { error } = await service
    .from('registration_job_market_results')
    .update({
      market_status: 'success',
      external_product_id: externalId,
      product_url: productUrl,
      attempt_count: attemptCount,
      last_attempted_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    })
    .eq('id', marketResultId)
  if (error) {
    throw HttpErrors.internal('jmr_update_failed', 'failed to update jmr success')
  }
}

export async function updateJmrFailure(
  service: Service,
  marketResultId: string,
  errorCode: JobMarketErrorCode,
  errorMessage: string,
  attemptCount: number,
  final: boolean,
): Promise<void> {
  const { error } = await service
    .from('registration_job_market_results')
    .update({
      market_status: final ? 'failed_final' : 'failed',
      error_code: errorCode,
      // raw 응답이 섞이지 않도록 MarketError.message 만 사용. 길이 200 제한.
      error_message: errorMessage.slice(0, 200),
      attempt_count: attemptCount,
      last_attempted_at: new Date().toISOString(),
    })
    .eq('id', marketResultId)
  if (error) {
    throw HttpErrors.internal('jmr_update_failed', 'failed to update jmr failure')
  }
}

export async function getJmrAttemptCount(
  service: Service,
  marketResultId: string,
  fallback: number,
): Promise<number> {
  const { data } = await service
    .from('registration_job_market_results')
    .select('attempt_count')
    .eq('id', marketResultId)
    .maybeSingle()
  return data && typeof data.attempt_count === 'number' ? data.attempt_count : fallback
}

/**
 * 잡 상태 재계산 (state.md §10.3).
 * - 처리 중 UI 가 'running' 으로 보이도록 pending/retrying → running 승격 (둘 다 합법 전이).
 * - 종결 판정/전이(succeeded/partial/failed + completed_at)는 rpc_recompute_job_status 에 위임.
 *
 * rpc_recompute_job_status 는 전이표(fn_registration_job_transition)를 우회해 행을 잠그고(for update)
 * 직접 UPDATE 하므로 running 뿐 아니라 **retrying 에서도 terminal 로 전이**된다. 과거 TS 재구현은
 * 종결도 전이표를 거쳐 retrying→terminal 이 illegal_transition 으로 거부 → 잡이 retrying 에
 * 영구 정체하던 버그(W1). non_final 잔존 시 RPC 가 현 상태를 그대로 유지하므로 no-op 안전.
 */
export async function recomputeJobStatus(
  service: Service,
  jobId: string,
  logger: Logger,
): Promise<void> {
  const { data: jobRow } = await service
    .from('registration_jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle()
  const currentStatus = jobRow && (jobRow as { status?: string }).status

  if (currentStatus === 'pending' || currentStatus === 'retrying') {
    const { error: transitionErr } = await service.rpc(
      'fn_registration_job_transition',
      { p_job_id: jobId, p_to_status: 'running', p_actor: 'system' },
    )
    if (transitionErr) {
      // race (다른 worker 가 이미 전이) 또는 illegal — 무시 (정상).
      logger.warn(
        { jobId, code: transitionErr.code ?? 'unknown', msg: transitionErr.message },
        '← job transition →running skipped',
      )
    }
  }

  // 종결 판정/전이는 RPC 위임 (전이표 우회 + terminal 재계산 금지 + completed_at 동시 갱신).
  const { error: recomputeErr } = await service.rpc('rpc_recompute_job_status', {
    p_job_id: jobId,
  })
  if (recomputeErr) {
    logger.error(
      { jobId, code: recomputeErr.code ?? 'unknown', msg: recomputeErr.message },
      '← rpc_recompute_job_status failed',
    )
  }
}
