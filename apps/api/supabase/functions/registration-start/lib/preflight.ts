/**
 * registration-start preflight 검증:
 *   1) product ownership (셀러 본인 소유 + 존재)
 *   2) 중복 트리거 가드 (활성 잡 SELECT)
 *   3) 마켓 계정 로드 (status='active' 인 market_accounts row)
 *
 * 모두 service_role 경로. seller_id 를 WHERE 절에 명시 강제 (state.md §3.4 service_role 경로).
 */

import {
  type getServiceClient,
  HttpErrors,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'

type Service = ReturnType<typeof getServiceClient>

export interface MarketAccountRow {
  id: string
  market_id: string
}

export async function ensureProductOwned(
  service: Service,
  sellerId: string,
  productId: string,
): Promise<void> {
  const { data, error } = await service
    .from('products')
    .select('id, seller_id, status')
    .eq('id', productId)
    .eq('seller_id', sellerId)
    .maybeSingle()
  if (error) {
    throw HttpErrors.internal('product_check_failed', 'failed to verify product ownership')
  }
  if (!data) {
    throw HttpErrors.notFound('product_not_found', 'product not found')
  }
}

export async function ensureNoActiveJob(
  service: Service,
  sellerId: string,
  productId: string,
  logger: Logger,
): Promise<void> {
  const { data, error } = await service
    .from('registration_jobs')
    .select('id, status')
    .eq('seller_id', sellerId)
    .eq('product_id', productId)
    .in('status', ['pending', 'running', 'retrying'])
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.error(
      { sellerId, productId, rpcError: error.code ?? 'unknown' },
      '← start duplicate check error',
    )
    throw HttpErrors.internal('duplicate_check_failed', 'failed to check active job')
  }
  if (data) {
    throw HttpErrors.conflict('job_in_progress', 'an active job exists for this product', {
      activeJobId: data.id,
    })
  }
}

export async function loadMarketAccounts(
  service: Service,
  sellerId: string,
  marketIds: readonly MarketId[],
  logger: Logger,
): Promise<Map<MarketId, MarketAccountRow>> {
  const { data, error } = await service
    .from('market_accounts')
    .select('id, market_id, status')
    .eq('seller_id', sellerId)
    .in('market_id', marketIds as unknown as string[])

  if (error) {
    logger.error(
      { sellerId, rpcError: error.code ?? 'unknown' },
      '← start market_accounts load error',
    )
    throw HttpErrors.internal('account_load_failed', 'failed to load market accounts')
  }
  const map = new Map<MarketId, MarketAccountRow>()
  for (const row of data ?? []) {
    if (row.status !== 'active') continue
    map.set(row.market_id as MarketId, {
      id: String(row.id),
      market_id: String(row.market_id),
    })
  }
  const missing = marketIds.filter((m) => !map.has(m))
  if (missing.length > 0) {
    throw HttpErrors.badRequest(
      'market_not_connected',
      `markets not connected or inactive: ${missing.join(',')}`,
      { missing },
    )
  }
  return map
}
