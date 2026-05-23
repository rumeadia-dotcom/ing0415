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
 * state.md §10.3 decideTerminalStatus 와 동등.
 * - 첫 in_flight 진입: pending → running.
 * - 모든 결과 종료: succeeded / partial / failed 중 하나.
 * - 진행 중이면 no-op.
 */
export async function recomputeJobStatus(
  service: Service,
  jobId: string,
  logger: Logger,
): Promise<void> {
  const { data, error } = await service
    .from('registration_job_market_results')
    .select('market_status, excluded')
    .eq('job_id', jobId)
  if (error || !data) {
    logger.warn({ jobId, rpcError: error?.code ?? 'unknown' }, '← recompute load failed')
    return
  }
  const active = data.filter((r) => !r.excluded)
  if (active.length === 0) return

  const hasNonFinal = active.some(
    (r) =>
      r.market_status === 'pending' ||
      r.market_status === 'in_flight' ||
      r.market_status === 'failed',
  )
  if (hasNonFinal) {
    // pending → running 만 전이. running/retrying 은 유지.
    // state.md §4: 합법 전이는 fn_registration_job_transition 단일 source of truth.
    // 현재 상태가 pending 이 아니면 race (worker 동시 invoke) — 무시 (정상).
    const { data: jobRow } = await service
      .from('registration_jobs')
      .select('status')
      .eq('id', jobId)
      .maybeSingle()
    if (jobRow && (jobRow as { status?: string }).status === 'pending') {
      const { error: transitionErr } = await service.rpc(
        'fn_registration_job_transition',
        { p_job_id: jobId, p_to_status: 'running', p_actor: 'system' },
      )
      if (transitionErr) {
        // race 또는 illegal_transition — 다른 worker 가 이미 전이시켰을 가능성.
        logger.warn(
          { jobId, code: transitionErr.code ?? 'unknown', msg: transitionErr.message },
          '← job transition pending→running skipped',
        )
      }
    }
    return
  }

  const successCount = active.filter((r) => r.market_status === 'success').length
  const failedFinalCount = active.filter((r) => r.market_status === 'failed_final').length

  let next: 'succeeded' | 'partial' | 'failed'
  if (successCount === active.length) next = 'succeeded'
  else if (failedFinalCount === active.length) next = 'failed'
  else next = 'partial'

  // 종결 전이도 fn_registration_job_transition 경유. 단, 현재 상태가 이미 terminal 이면 raise.
  // running / retrying 에서만 종결로 갈 수 있음 (state.md §4).
  const { data: jobRow } = await service
    .from('registration_jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle()
  const currentStatus = jobRow && (jobRow as { status?: string }).status
  if (currentStatus !== 'running' && currentStatus !== 'retrying') {
    // pending 또는 이미 terminal. recompute 호출 시점 race — 정상으로 무시.
    logger.warn({ jobId, currentStatus }, '← terminal transition skipped (not in running/retrying)')
    return
  }
  const { error: transitionErr } = await service.rpc(
    'fn_registration_job_transition',
    { p_job_id: jobId, p_to_status: next, p_actor: 'system' },
  )
  if (transitionErr) {
    logger.error(
      { jobId, to: next, code: transitionErr.code ?? 'unknown', msg: transitionErr.message },
      '← job terminal transition failed',
    )
  }
}
