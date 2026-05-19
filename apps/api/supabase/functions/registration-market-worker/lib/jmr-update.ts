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
    await service
      .from('registration_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
      .in('status', ['pending'])
    return
  }

  const successCount = active.filter((r) => r.market_status === 'success').length
  const failedFinalCount = active.filter((r) => r.market_status === 'failed_final').length

  let next: 'succeeded' | 'partial' | 'failed'
  if (successCount === active.length) next = 'succeeded'
  else if (failedFinalCount === active.length) next = 'failed'
  else next = 'partial'

  await service
    .from('registration_jobs')
    .update({ status: next, completed_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['running', 'retrying', 'pending'])
}
