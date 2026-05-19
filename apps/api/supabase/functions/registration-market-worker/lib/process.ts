/**
 * 단일 마켓 처리 본체:
 *   jmr in_flight → 토큰 prefetch (+ 필요 시 refresh)
 *   → adapter.transformProduct → withRetry(adapter.createProduct)
 *
 * - 본 모듈은 happy path 만 반환. 실패 시 throw — 호출측 handleFailure 가 jmr 업데이트.
 */

import {
  DEFAULT_RETRY,
  getMarketAdapter,
  type getServiceClient,
  loadCredential,
  MarketError,
  withRetry,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'
import {
  loadCredentialId,
  loadDomainProduct,
  loadJmr,
  type JobContext,
} from './data-load.ts'
import { markJmrInFlight, recomputeJobStatus } from './jmr-update.ts'
import { tryRefreshCredential } from './refresh-credential.ts'

type Service = ReturnType<typeof getServiceClient>

export interface ProcessInput {
  jobId: string
  marketId: MarketId
  marketResultId: string
  correlationId: string
}

export interface ProcessResult {
  externalId: string
  productUrl: string
  attempts: number
}

export async function processMarket(
  input: ProcessInput,
  jobCtx: JobContext,
  service: Service,
  logger: Logger,
): Promise<ProcessResult> {
  const jmr = await loadJmr(service, input.marketResultId, input.jobId, logger)
  const newAttemptCount = jmr.attemptCount + 1

  await markJmrInFlight(service, input.marketResultId, newAttemptCount)
  await recomputeJobStatus(service, input.jobId, logger)

  const adapter = getMarketAdapter(input.marketId)
  const credMeta = await loadCredentialId(
    service,
    jmr.marketAccountId,
    jobCtx.sellerId,
    logger,
  )

  const { product, mapping } = await loadDomainProduct(
    service,
    jobCtx.productId,
    jobCtx.sellerId,
    input.marketId,
  )

  logger.info(
    {
      event: 'market_worker_start',
      jobId: input.jobId,
      market: input.marketId,
      sellerId: jobCtx.sellerId,
      attempt: newAttemptCount,
      correlationId: input.correlationId,
    },
    '→ worker',
  )

  // 토큰 만료 검사 + 자동 refresh.
  const cred = await loadCredential({
    credentialId: credMeta.credentialId,
    correlationId: input.correlationId,
    logger,
  })
  const expMs = Date.parse(cred.tokenExpiresAt)
  if (Number.isFinite(expMs) && expMs - Date.now() < 60_000) {
    const refreshed = await tryRefreshCredential({
      service,
      adapter,
      credentialId: credMeta.credentialId,
      sellerId: jobCtx.sellerId,
      marketId: input.marketId,
      marketAccountId: jmr.marketAccountId,
      correlationId: input.correlationId,
      logger,
    })
    if (!refreshed) {
      throw new MarketError('unauthorized', 'oauth refresh failed', {
        market: input.marketId,
      })
    }
  }

  const payload = adapter.transformProduct(product, mapping)
  const result = await withRetry(
    () => adapter.createProduct(payload),
    {
      market: input.marketId,
      correlationId: input.correlationId,
      jobId: input.jobId,
      logger,
    },
    DEFAULT_RETRY,
  )

  return {
    externalId: result.externalId,
    productUrl: result.productUrl,
    attempts: newAttemptCount,
  }
}
