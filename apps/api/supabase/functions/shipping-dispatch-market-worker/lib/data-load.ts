/**
 * shipping-dispatch-market-worker 도메인 데이터 로딩.
 *
 * - SELECT 는 service_role + seller_id 강제.
 * - shipping_jobs / shipping_job_results / orders 로딩.
 */

import {
  type getServiceClient,
  HttpErrors,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'

type Service = ReturnType<typeof getServiceClient>

export interface ShippingJobContext {
  jobId: string
  sellerId: string
}

export interface ShippingResultRow {
  id: string
  order_id: string
  market_id: string
  market_account_id: string
  result_status: string
  attempt_count: number
  waybill_number: string | null
  carrier_code: string | null
  external_order_id: string | null
}

export async function loadShippingJobContext(
  service: Service,
  jobId: string,
  logger: Logger,
): Promise<ShippingJobContext> {
  const { data, error } = await service
    .from('shipping_jobs')
    .select('id, seller_id, status')
    .eq('id', jobId)
    .maybeSingle()
  if (error) {
    logger.error(
      { jobId, rpcError: error.code ?? 'unknown' },
      '← shipping worker job load error',
    )
    throw HttpErrors.internal('shipping_job_load_failed', 'failed to load shipping job')
  }
  if (!data) {
    throw HttpErrors.notFound('shipping_job_not_found', 'shipping job not found')
  }
  if (data.status === 'cancelled') {
    throw HttpErrors.conflict('shipping_job_cancelled', 'shipping job cancelled')
  }
  return {
    jobId: String(data.id),
    sellerId: String(data.seller_id),
  }
}

/**
 * 마켓별 결과 row + 매핑된 주문의 external_order_id 까지 로드.
 * - shipping_job_results (jobId, marketId)
 * - orders (id, external_order_id, status) — order_id 로 join 대신 별도 SELECT
 */
export async function loadShippingResultsForMarket(
  service: Service,
  jobId: string,
  marketId: MarketId,
  orderIds: readonly string[],
  sellerId: string,
  logger: Logger,
): Promise<ShippingResultRow[]> {
  const { data: resultRows, error: resultErr } = await service
    .from('shipping_job_results')
    .select(
      'id, order_id, market_id, market_account_id, result_status, attempt_count, waybill_number, carrier_code',
    )
    .eq('job_id', jobId)
    .eq('market_id', marketId)
    .in('order_id', orderIds as string[])

  if (resultErr || !resultRows) {
    logger.error(
      { jobId, market: marketId, rpcError: resultErr?.code ?? 'unknown' },
      '← shipping_job_results load error',
    )
    throw HttpErrors.internal(
      'shipping_results_load_failed',
      'failed to load shipping job results',
    )
  }

  if (resultRows.length === 0) {
    return []
  }

  const orderIdsForJoin = resultRows.map((r) => String(r.order_id))
  const { data: orderRows, error: orderErr } = await service
    .from('orders')
    .select('id, external_order_id')
    .eq('seller_id', sellerId)
    .in('id', orderIdsForJoin)

  if (orderErr) {
    logger.error(
      { jobId, market: marketId, rpcError: orderErr.code ?? 'unknown' },
      '← orders load error',
    )
    throw HttpErrors.internal(
      'orders_join_load_failed',
      'failed to join orders for external_order_id',
    )
  }

  const externalById = new Map<string, string>()
  for (const o of orderRows ?? []) {
    externalById.set(String(o.id), String(o.external_order_id))
  }

  return resultRows.map((r) => ({
    id: String(r.id),
    order_id: String(r.order_id),
    market_id: String(r.market_id),
    market_account_id: String(r.market_account_id),
    result_status: String(r.result_status),
    attempt_count: typeof r.attempt_count === 'number' ? r.attempt_count : 0,
    waybill_number: r.waybill_number ? String(r.waybill_number) : null,
    carrier_code: r.carrier_code ? String(r.carrier_code) : null,
    external_order_id: externalById.get(String(r.order_id)) ?? null,
  }))
}
