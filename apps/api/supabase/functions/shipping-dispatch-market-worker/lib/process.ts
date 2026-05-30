/**
 * shipping-dispatch-market-worker 본체.
 *
 * 마스터: docs/spec/PRD.md §4.
 *
 * - 한 마켓 안의 N개 orderIds 를 순회 — 각 주문은 격리 (한 주문 실패가 다른 주문 진행을 막지 않음).
 * - 주문당 흐름:
 *     1) status pending → in_flight (PRD §4 컬럼명 `status`)
 *     2) adapter.submitTracking(externalOrderId, waybillNumber, carrierCode) withRetry
 *     3) 성공: result.success + orders.status='tracking_submitted'
 *              + bumpJobCounters({ success: 1 })
 *     4) 실패: error_code 매핑 + final 판정 + orders.status='dispatch_failed' (final 일 때)
 *              + bumpJobCounters({ failed: 1 }) — final 시점에만 증분
 *     5) recomputeShippingJobStatus — Realtime push.
 *
 * - adapter.submitTracking 이 정의되지 않은 마켓 (예: 11번가 v2) 은
 *   본 워커가 'validation' final 로 처리 후 다음 주문으로 진행.
 */

import {
  DEFAULT_RETRY,
  getMarketAdapter,
  type getServiceClient,
  loadCredential,
  MarketError,
  maskError,
  withRetry,
  type Logger,
  type MarketAdapter,
  type MarketId,
} from '../../_shared/index.ts'
import type { ShippingErrorCode } from '../../shipping-dispatch-job/lib/types.ts'
import { loadShippingResultsForMarket, type ShippingResultRow } from './data-load.ts'
import { buildSubmitTrackingExtra } from './tracking-opts.ts'
import {
  isFinalShippingErrorCode,
  mapMarketErrorToShippingCode,
} from './error-map.ts'
import {
  bumpJobCounters,
  getResultAttemptCount,
  markResultInFlight,
  recomputeShippingJobStatus,
  updateResultFailure,
  updateResultSuccess,
} from './result-update.ts'

type Service = ReturnType<typeof getServiceClient>

export interface ProcessShippingInput {
  jobId: string
  sellerId: string
  marketId: MarketId
  orderIds: string[]
  correlationId: string
}

export interface ProcessShippingSummary {
  total: number
  success: number
  failed: number
  failedFinal: number
}

const MAX_ATTEMPT = 3

export async function processShippingMarket(
  input: ProcessShippingInput,
  service: Service,
  logger: Logger,
): Promise<ProcessShippingSummary> {
  const adapter = getMarketAdapter(input.marketId)

  const rows = await loadShippingResultsForMarket(
    service,
    input.jobId,
    input.marketId,
    input.orderIds,
    input.sellerId,
    logger,
  )

  if (rows.length === 0) {
    logger.warn(
      {
        jobId: input.jobId,
        market: input.marketId,
        correlationId: input.correlationId,
      },
      '← shipping worker: no result rows for market',
    )
    return { total: 0, success: 0, failed: 0, failedFinal: 0 }
  }

  logger.info(
    {
      event: 'shipping_worker_start',
      jobId: input.jobId,
      market: input.marketId,
      total: rows.length,
      correlationId: input.correlationId,
    },
    '→ shipping worker',
  )

  let success = 0
  let failed = 0
  let failedFinal = 0

  for (const row of rows) {
    try {
      const ok = await processSingleOrder({
        row,
        adapter,
        input,
        service,
        logger,
      })
      if (ok) success += 1
    } catch (err) {
      const { isFinal } = await handleOrderFailure({
        row,
        err,
        input,
        service,
        logger,
      })
      if (isFinal) failedFinal += 1
      else failed += 1
    }

    // 한 row 갱신할 때마다 잡 상태 재계산 (Realtime push 트리거).
    await recomputeShippingJobStatus(service, input.jobId)
  }

  logger.info(
    {
      event: 'shipping_worker_complete',
      jobId: input.jobId,
      market: input.marketId,
      total: rows.length,
      success,
      failed,
      failedFinal,
      correlationId: input.correlationId,
    },
    '← shipping worker complete',
  )

  return { total: rows.length, success, failed, failedFinal }
}

/**
 * 한 주문 처리. 성공 시 true 반환, 실패 시 throw (호출측 catch).
 *
 * adapter.submitTracking 이 undefined 면 'validation' MarketError 로 즉시 throw
 * → handleOrderFailure 가 final 처리.
 */
async function processSingleOrder(args: {
  row: ShippingResultRow
  adapter: MarketAdapter
  input: ProcessShippingInput
  service: Service
  logger: Logger
}): Promise<boolean> {
  const { row, adapter, input, service, logger } = args

  if (!row.external_order_id) {
    throw new MarketError(
      'validation',
      'order missing external_order_id',
      { market: input.marketId },
    )
  }
  if (!row.waybill_number || !row.carrier_code) {
    throw new MarketError(
      'validation',
      'result row missing waybill_number / carrier_code',
      { market: input.marketId },
    )
  }

  const submitFn = adapter.submitTracking
  if (typeof submitFn !== 'function') {
    throw new MarketError(
      'validation',
      `submitTracking not implemented for ${input.marketId}`,
      { market: input.marketId },
    )
  }

  const newAttemptCount = row.attempt_count + 1
  await markResultInFlight(service, row.id, newAttemptCount)

  // 토큰 prefetch — 만료 60초 이내 시 oauth_expired throw (refresh 는 후속 PR).
  // credential 은 row.market_account_id → market_credentials.active 단일 row 로 조회.
  const credMeta = await service
    .from('market_credentials')
    .select('id, status')
    .eq('market_account_id', row.market_account_id)
    .eq('seller_id', input.sellerId)
    .eq('status', 'active')
    .maybeSingle()
  if (credMeta.error || !credMeta.data) {
    throw new MarketError('unauthorized', 'active credential not found', {
      market: input.marketId,
    })
  }
  const cred = await loadCredential({
    credentialId: String(credMeta.data.id),
    correlationId: input.correlationId,
    logger,
  })
  if (cred.tokenExpiresAt) {
    const expMs = Date.parse(cred.tokenExpiresAt)
    if (Number.isFinite(expMs) && expMs - Date.now() < 60_000) {
      throw new MarketError('unauthorized', 'oauth token near expiry', {
        market: input.marketId,
      })
    }
  }

  logger.info(
    {
      jobId: input.jobId,
      market: input.marketId,
      resultId: row.id,
      orderId: row.order_id,
      attempt: newAttemptCount,
      waybillLen: row.waybill_number.length,
      carrier: row.carrier_code,
      correlationId: input.correlationId,
    },
    '→ market submitTracking request',
  )

  // 167/174 가드로 nullable 이 모두 string 으로 좁혀진 상태 — 명시적 변수로 추출 (no-non-null-assertion).
  const externalOrderId: string = row.external_order_id
  const waybillNumber: string = row.waybill_number
  const carrierCode: string = row.carrier_code
  // NEW-1: orders.extra → 마켓별 발송 보조키(11번가 dlvNo). 없으면 undefined → 어댑터가 fallback.
  const trackingExtra = buildSubmitTrackingExtra(row.extra)
  const result = await withRetry(
    () => submitFn.call(adapter, externalOrderId, waybillNumber, carrierCode, trackingExtra),
    {
      market: input.marketId,
      correlationId: input.correlationId,
      jobId: input.jobId,
      logger,
    },
    DEFAULT_RETRY,
  )

  await updateResultSuccess(service, {
    resultId: row.id,
    orderId: row.order_id,
    sellerId: input.sellerId,
    attemptCount: newAttemptCount,
    trackingReceiptId: result.trackingReceiptId ?? null,
  })

  // PRD §4: shipping_jobs.success_count 증분 (atomic RPC).
  await bumpJobCounters(service, input.jobId, { success: 1 })

  logger.info(
    {
      jobId: input.jobId,
      market: input.marketId,
      resultId: row.id,
      orderId: row.order_id,
      attempt: newAttemptCount,
      correlationId: input.correlationId,
    },
    '← market submitTracking success',
  )

  return true
}

async function handleOrderFailure(args: {
  row: ShippingResultRow
  err: unknown
  input: ProcessShippingInput
  service: Service
  logger: Logger
}): Promise<{ isFinal: boolean; code: ShippingErrorCode }> {
  const { row, err, input, service, logger } = args

  const oauthRefreshFailed = err instanceof MarketError && err.code === 'unauthorized'
  const marketErr = err instanceof MarketError ? err : null
  const code: ShippingErrorCode = marketErr
    ? mapMarketErrorToShippingCode(marketErr.code, oauthRefreshFailed)
    : 'unknown'

  const attempts = await getResultAttemptCount(
    service,
    row.id,
    row.attempt_count + 1,
  )
  const final = attempts >= MAX_ATTEMPT || isFinalShippingErrorCode(code)
  const message =
    marketErr?.message ?? (err instanceof Error ? err.message : 'unknown worker error')

  await updateResultFailure(service, {
    resultId: row.id,
    orderId: row.order_id,
    sellerId: input.sellerId,
    errorCode: code,
    errorMessage: message,
    attemptCount: attempts,
    final,
  })

  // PRD §4: failed_count 는 최종(final) 결정 시점에만 증분.
  // 재시도 대기(failed-but-retryable)는 카운트 안 함 — 다음 시도에서 결정.
  if (final) {
    await bumpJobCounters(service, input.jobId, { failed: 1 })
  }

  logger.error(
    {
      event: 'shipping_order_failure',
      jobId: input.jobId,
      market: input.marketId,
      resultId: row.id,
      orderId: row.order_id,
      errorCode: code,
      final,
      attempt: attempts,
      err: maskError(err),
      correlationId: input.correlationId,
    },
    '← shipping order error',
  )

  return { isFinal: final, code }
}
