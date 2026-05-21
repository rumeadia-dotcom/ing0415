/**
 * shipping_jobs / shipping_job_results INSERT.
 *
 * 마스터: docs/spec/PRD.md §8 (데이터 모델).
 *
 * - service_role 경로. shipping_job_results 는 클라이언트 INSERT 차단.
 * - 한 주문당 row 1개 (마켓 어댑터 submitTracking 호출 단위).
 * - 본 모듈은 INSERT 만 담당. worker invoke 는 호출측이 진행.
 *
 * PRD §4 매핑:
 *   - shipping_jobs.order_count = preflight orders.length (INSERT 시점에 채움)
 *   - shipping_jobs.success_count / failed_count = 워커 완료 시 누적 update
 *     (lib/result-update.ts 의 bumpJobCounters 가 담당)
 *   - shipping_job_results.status = 'pending' 초기값 (컬럼명 PRD §4 정합)
 */

import {
  type getServiceClient,
  HttpErrors,
  type Logger,
} from '../../_shared/index.ts'
import type { OrderRow } from './types.ts'

type Service = ReturnType<typeof getServiceClient>

export async function insertShippingJob(
  service: Service,
  args: {
    sellerId: string
    orderCount: number
    correlationId: string
  },
  logger: Logger,
): Promise<string> {
  const { data, error } = await service
    .from('shipping_jobs')
    .insert({
      seller_id: args.sellerId,
      status: 'pending',
      // PRD §4: order_count / success_count / failed_count
      order_count: args.orderCount,
      success_count: 0,
      failed_count: 0,
      correlation_id: args.correlationId,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error(
      {
        sellerId: args.sellerId,
        orderCount: args.orderCount,
        rpcError: error?.code ?? 'unknown',
      },
      '← shipping_job insert error',
    )
    throw HttpErrors.internal(
      'shipping_job_insert_failed',
      'failed to insert shipping job',
    )
  }
  return data.id as string
}

export async function insertShippingJobResults(
  service: Service,
  jobId: string,
  orders: readonly OrderRow[],
  logger: Logger,
): Promise<void> {
  if (orders.length === 0) return

  const payload = orders.map((order) => ({
    job_id: jobId,
    order_id: order.id,
    market_id: order.market_id,
    market_account_id: order.market_account_id,
    // PRD §4 컬럼명 정합: `status` (result_status 아님)
    status: 'pending' as const,
    attempt_count: 0,
    waybill_number: order.waybill_number,
    carrier_code: order.carrier_code,
  }))

  const { error } = await service.from('shipping_job_results').insert(payload)

  if (error) {
    logger.error(
      { jobId, count: payload.length, rpcError: error.code ?? 'unknown' },
      '← shipping_job_results insert error',
    )
    throw HttpErrors.internal(
      'shipping_results_insert_failed',
      'failed to insert shipping job results',
    )
  }
}

/**
 * pending → running 전이. fan-out 직전 호출.
 * 마켓 워커는 본인 row 들의 status 만 갱신하므로,
 * shipping_jobs.status 는 본 시점·완료 recompute 시점만 변경.
 */
export async function markShippingJobRunning(
  service: Service,
  jobId: string,
): Promise<void> {
  const { error } = await service
    .from('shipping_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .in('status', ['pending'])
  if (error) {
    throw HttpErrors.internal(
      'shipping_job_update_failed',
      'failed to mark shipping job running',
    )
  }
}
