/**
 * registration_jobs / registration_job_market_results INSERT 트랜잭션.
 *
 * - service_role 경로. RLS bypass 사유: registration_job_market_results 는 클라이언트
 *   INSERT 차단 정책 (state.md §3.4).
 * - 본 모듈은 INSERT 만 담당. worker invoke 는 호출측이 진행.
 */

import {
  type getServiceClient,
  HttpErrors,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'
import type { MarketAccountRow } from './preflight.ts'

type Service = ReturnType<typeof getServiceClient>

export interface InsertedJmrRow {
  id: string
  market_id: string
  market_account_id: string
}

export async function insertJob(
  service: Service,
  args: {
    sellerId: string
    productId: string
    parentJobId: string | null
    correlationId: string
  },
  logger: Logger,
): Promise<string> {
  const { data, error } = await service
    .from('registration_jobs')
    .insert({
      seller_id: args.sellerId,
      product_id: args.productId,
      status: 'pending',
      retry_count: 0,
      parent_job_id: args.parentJobId,
      correlation_id: args.correlationId,
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error(
      {
        sellerId: args.sellerId,
        productId: args.productId,
        rpcError: error?.code ?? 'unknown',
      },
      '← job insert error',
    )
    throw HttpErrors.internal('job_insert_failed', 'failed to insert registration job')
  }
  return data.id as string
}

export async function insertJmrRows(
  service: Service,
  jobId: string,
  marketIds: readonly MarketId[],
  accountMap: Map<MarketId, MarketAccountRow>,
  logger: Logger,
): Promise<InsertedJmrRow[]> {
  const payload = marketIds.map((marketId) => {
    const account = accountMap.get(marketId)
    if (!account) {
      // preflight.loadMarketAccounts 가 보장하지만 type narrowing.
      throw HttpErrors.internal('account_map_inconsistent', 'market account missing')
    }
    return {
      job_id: jobId,
      market_id: marketId,
      market_account_id: account.id,
      market_status: 'pending' as const,
      attempt_count: 0,
    }
  })

  const { data, error } = await service
    .from('registration_job_market_results')
    .insert(payload)
    .select('id, market_id, market_account_id')

  if (error || !data) {
    logger.error(
      { jobId, rpcError: error?.code ?? 'unknown' },
      '← jmr insert error',
    )
    throw HttpErrors.internal('jmr_insert_failed', 'failed to insert market results')
  }

  return data.map((row) => ({
    id: String(row.id),
    market_id: String(row.market_id),
    market_account_id: String(row.market_account_id),
  }))
}
