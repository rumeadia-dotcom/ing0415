/**
 * shipping_job_results UPDATE / orders.status UPDATE / 잡 상태 재계산 helper.
 *
 * - 한 주문 단위 격리: 한 row UPDATE 가 다른 row 에 영향 없게 PK 기반.
 * - orders.status 는 result 성공/실패 단위로만 변경.
 * - 잡 상태 recompute: 마켓 워커가 한 row 라도 갱신할 때마다 호출 → Realtime 푸시.
 */

import {
  type getServiceClient,
  HttpErrors,
} from '../../_shared/index.ts'
import type { ShippingErrorCode } from '../../shipping-dispatch-job/lib/types.ts'

type Service = ReturnType<typeof getServiceClient>

export async function markResultInFlight(
  service: Service,
  resultId: string,
  newAttemptCount: number,
): Promise<void> {
  const { error } = await service
    .from('shipping_job_results')
    .update({
      result_status: 'in_flight',
      attempt_count: newAttemptCount,
      last_attempted_at: new Date().toISOString(),
    })
    .eq('id', resultId)
  if (error) {
    throw HttpErrors.internal(
      'shipping_result_update_failed',
      'failed to mark in_flight',
    )
  }
}

export async function updateResultSuccess(
  service: Service,
  args: {
    resultId: string
    orderId: string
    sellerId: string
    attemptCount: number
    trackingReceiptId: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()

  const { error: rErr } = await service
    .from('shipping_job_results')
    .update({
      result_status: 'success',
      attempt_count: args.attemptCount,
      last_attempted_at: now,
      tracking_receipt_id: args.trackingReceiptId,
      error_code: null,
      error_message: null,
    })
    .eq('id', args.resultId)
  if (rErr) {
    throw HttpErrors.internal(
      'shipping_result_update_failed',
      'failed to update result success',
    )
  }

  // orders.status = 'tracking_submitted' (waybill_printed 일 때만 전이).
  const { error: oErr } = await service
    .from('orders')
    .update({ status: 'tracking_submitted' })
    .eq('id', args.orderId)
    .eq('seller_id', args.sellerId)
    .eq('status', 'waybill_printed')
  if (oErr) {
    throw HttpErrors.internal(
      'orders_status_update_failed',
      'failed to update order status to tracking_submitted',
    )
  }
}

export async function updateResultFailure(
  service: Service,
  args: {
    resultId: string
    orderId: string
    sellerId: string
    errorCode: ShippingErrorCode
    errorMessage: string
    attemptCount: number
    final: boolean
  },
): Promise<void> {
  const now = new Date().toISOString()

  const { error: rErr } = await service
    .from('shipping_job_results')
    .update({
      result_status: args.final ? 'failed_final' : 'failed',
      error_code: args.errorCode,
      // raw 응답이 섞이지 않도록 message 만 사용. 길이 200 제한.
      error_message: args.errorMessage.slice(0, 200),
      attempt_count: args.attemptCount,
      last_attempted_at: now,
    })
    .eq('id', args.resultId)
  if (rErr) {
    throw HttpErrors.internal(
      'shipping_result_update_failed',
      'failed to update result failure',
    )
  }

  if (args.final) {
    // orders.status = 'dispatch_failed' (waybill_printed 일 때만 전이).
    const { error: oErr } = await service
      .from('orders')
      .update({ status: 'dispatch_failed' })
      .eq('id', args.orderId)
      .eq('seller_id', args.sellerId)
      .eq('status', 'waybill_printed')
    if (oErr) {
      throw HttpErrors.internal(
        'orders_status_update_failed',
        'failed to update order status to dispatch_failed',
      )
    }
  }
}

/**
 * shipping_jobs 상태 재계산.
 * - 진행 중 (pending/in_flight/failed-but-retryable) row 있으면 'running' 유지.
 * - 모두 종료 (success / failed_final) 시 → succeeded / partial / failed 결정.
 *
 * Realtime: 본 UPDATE 가 shipping_jobs row 변경을 트리거 → 프론트 구독.
 */
export async function recomputeShippingJobStatus(
  service: Service,
  jobId: string,
): Promise<void> {
  const { data, error } = await service
    .from('shipping_job_results')
    .select('result_status')
    .eq('job_id', jobId)
  if (error || !data) return

  if (data.length === 0) return

  const hasNonFinal = data.some(
    (r) =>
      r.result_status === 'pending' ||
      r.result_status === 'in_flight' ||
      r.result_status === 'failed',
  )
  if (hasNonFinal) {
    await service
      .from('shipping_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId)
      .in('status', ['pending'])
    return
  }

  const total = data.length
  const successCount = data.filter((r) => r.result_status === 'success').length
  const failedFinalCount = data.filter((r) => r.result_status === 'failed_final').length

  let next: 'succeeded' | 'partial' | 'failed'
  if (successCount === total) next = 'succeeded'
  else if (failedFinalCount === total) next = 'failed'
  else next = 'partial'

  await service
    .from('shipping_jobs')
    .update({ status: next, completed_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['running', 'pending'])
}

export async function getResultAttemptCount(
  service: Service,
  resultId: string,
  fallback: number,
): Promise<number> {
  const { data } = await service
    .from('shipping_job_results')
    .select('attempt_count')
    .eq('id', resultId)
    .maybeSingle()
  return data && typeof data.attempt_count === 'number' ? data.attempt_count : fallback
}
