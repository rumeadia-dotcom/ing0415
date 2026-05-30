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
  maskError,
  withRetry,
  type Logger,
  type MarketId,
  type StoredCredential,
} from '../../_shared/index.ts'
import {
  loadCredentialId,
  loadDomainProduct,
  loadJmr,
  type JobContext,
} from './data-load.ts'
import { injectCertRequiredYn } from './cert-inject.ts'
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

  // 저장 자격증명으로 어댑터 hydrate (authenticate 미경유 경로 — createProduct 전 필수).
  adapter.hydrate({
    kind: cred.credentialKind,
    payload: cred.payload,
  } as StoredCredential)

  // NEW-2: 어댑터가 cert 메타 조회를 지원하면(11번가 1617) categoryId 의 KC인증 필수여부를
  // mapping.extra.certRequiredYn 로 주입. 조회 실패는 등록을 막지 않음(warn 후 미주입 진행 —
  // requiredYn=Y 인데 인증 누락 시 createProduct 가 명확히 거부하므로 그 지점에서 실패).
  let effectiveMapping = mapping
  const fetchCertMeta = adapter.fetchCategoryCertMeta
  if (typeof fetchCertMeta === 'function') {
    try {
      const certMap = await fetchCertMeta.call(adapter, mapping.categoryId)
      effectiveMapping = injectCertRequiredYn(mapping, certMap)
    } catch (err) {
      logger.warn(
        {
          jobId: input.jobId,
          market: input.marketId,
          categoryId: mapping.categoryId,
          err: maskError(err),
          correlationId: input.correlationId,
        },
        '← cert meta 조회 실패 — certRequiredYn 미주입 진행',
      )
    }
  }

  const payload = adapter.transformProduct(product, effectiveMapping)
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
