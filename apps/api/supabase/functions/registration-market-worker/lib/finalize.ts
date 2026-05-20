/**
 * worker 결과 적재 (성공 / 실패) + audit + 잡 상태 재계산 + 응답 생성.
 *
 * - 한 마켓 실패가 다른 마켓에 영향 없게: 본 모듈은 단일 마켓 jmr 만 갱신.
 *   잡 상태는 recomputeJobStatus 가 단일 결정자.
 */

import {
  appendAudit,
  type getServiceClient,
  MarketError,
  maskError,
  ok,
  type JobMarketErrorCode,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'
import { isFinalErrorCode, mapMarketErrorToJmrCode } from './error-map.ts'
import type { JobContext } from './data-load.ts'
import {
  getJmrAttemptCount,
  recomputeJobStatus,
  updateJmrFailure,
  updateJmrSuccess,
} from './jmr-update.ts'

type Service = ReturnType<typeof getServiceClient>

export interface FinalizeInput {
  jobId: string
  marketId: MarketId
  marketResultId: string
  correlationId: string
}

export async function handleSuccess(args: {
  service: Service
  input: FinalizeInput
  jobCtx: JobContext
  result: { externalId: string; productUrl: string; attempts: number }
  logger: Logger
}): Promise<Response> {
  const { service, input, jobCtx, result, logger } = args
  await updateJmrSuccess(
    service,
    input.marketResultId,
    result.externalId,
    result.productUrl,
    result.attempts,
  )
  logger.info(
    {
      event: 'market_worker_success',
      jobId: input.jobId,
      market: input.marketId,
      externalIdLen: result.externalId.length,
      attempt: result.attempts,
      correlationId: input.correlationId,
    },
    '← worker success',
  )
  await appendAudit({
    category: 'registration',
    event: 'registration.market_success',
    sellerId: jobCtx.sellerId,
    meta: {
      jobId: input.jobId,
      market: input.marketId,
      attempt: result.attempts,
    },
    correlationId: input.correlationId,
    logger,
  })
  await recomputeJobStatus(service, input.jobId, logger)
  return ok(
    {
      marketResultId: input.marketResultId,
      finalStatus: 'success' as const,
      externalProductId: result.externalId,
      productUrl: result.productUrl,
    },
    { correlationId: input.correlationId },
  )
}

export async function handleFailure(args: {
  service: Service
  input: FinalizeInput
  jobCtx: JobContext
  err: unknown
  fallbackAttempt: number
  logger: Logger
}): Promise<Response> {
  const { service, input, jobCtx, err, fallbackAttempt, logger } = args

  // unauthorized 가 여기까지 도달 = processMarket 내 refresh 시도 후 실패한 경우.
  const oauthRefreshFailed = err instanceof MarketError && err.code === 'unauthorized'
  const marketErr = err instanceof MarketError ? err : null
  const code: JobMarketErrorCode = marketErr
    ? mapMarketErrorToJmrCode(marketErr.code, oauthRefreshFailed)
    : 'unknown'

  const attempts = await getJmrAttemptCount(service, input.marketResultId, fallbackAttempt)
  const final = attempts >= 3 || isFinalErrorCode(code)
  const message =
    marketErr?.message ?? (err instanceof Error ? err.message : 'unknown worker error')

  await updateJmrFailure(
    service,
    input.marketResultId,
    code,
    message,
    attempts,
    final,
  )

  logger.error(
    {
      event: 'market_worker_failure',
      jobId: input.jobId,
      market: input.marketId,
      errorCode: code,
      final,
      attempt: attempts,
      err: maskError(err),
      correlationId: input.correlationId,
    },
    '← worker error',
  )

  await appendAudit({
    category: 'registration',
    event: 'registration.market_failure',
    sellerId: jobCtx.sellerId,
    meta: {
      jobId: input.jobId,
      market: input.marketId,
      errorCode: code,
      final,
      attempt: attempts,
    },
    correlationId: input.correlationId,
    logger,
  })

  await recomputeJobStatus(service, input.jobId, logger)

  return ok(
    {
      marketResultId: input.marketResultId,
      finalStatus: final ? ('failed_final' as const) : ('failed' as const),
      errorCode: code,
    },
    { correlationId: input.correlationId },
  )
}
