/**
 * Edge Function: registration-start
 *
 * 마스터:
 *   - docs/architecture/v1/features/registration.md §6.3
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §4.1, §9
 *
 * 책임:
 *   - 셀러가 Step 5 "일괄 등록" 클릭 시 호출.
 *   - 1) JWT 검증 → 2) ownership 검증 → 3) 중복 트리거 가드 → 4) 마켓 계정 로드
 *     → 5) registration_jobs INSERT → 6) registration_job_market_results INSERT
 *     → 7) registration-market-worker 마켓당 1회 fire-and-forget invoke
 *     → 8) audit → 응답 201 { jobId, marketResults[] }.
 *
 * 강제:
 *   - 같은 (seller_id, product_id) 의 pending/running/retrying 잡 존재 시 409.
 *   - 마켓별 market_accounts row 가 없거나 inactive 면 즉시 400.
 *   - worker invoke 는 fire-and-forget (timeout 회피).
 *   - parent_job_id 가 주어졌을 때만 추적 컬럼 채움 (n25 흐름).
 *   - service_role 사용. seller_id 명시 WHERE 강제 (state.md §3.4 service_role 경로).
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  invokeMarketWorker,
  MarketIdSchema,
  ok,
  parseBody,
  requireBearer,
  withRequest,
  type MarketId,
} from '../_shared/index.ts'
import {
  ensureNoActiveJob,
  ensureProductOwned,
  loadMarketAccounts,
} from './lib/preflight.ts'
import { insertJmrRows, insertJob } from './lib/insert.ts'

const RequestSchema = z.object({
  productId: z.string().uuid(),
  marketIds: z.array(MarketIdSchema).min(1).max(5),
  parentJobId: z.string().uuid().optional(),
})

export default Deno.serve(
  withRequest('registration-start', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const body = await parseBody(req, RequestSchema)

    const userClient = getUserClient(jwt)
    const userRes = await userClient.auth.getUser()
    if (userRes.error || !userRes.data.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userRes.data.user.id

    logger.info(
      {
        event: 'registration_start',
        sellerId,
        productId: body.productId,
        marketIds: body.marketIds,
        parentJobId: body.parentJobId ?? null,
        correlationId,
      },
      '→ registration start',
    )

    const service = getServiceClient()

    // Preflight: ownership → 중복 잡 → 마켓 계정.
    await ensureProductOwned(service, sellerId, body.productId)
    await ensureNoActiveJob(service, sellerId, body.productId, logger)
    const accountMap = await loadMarketAccounts(service, sellerId, body.marketIds, logger)

    // INSERT 단계
    const jobId = await insertJob(
      service,
      {
        sellerId,
        productId: body.productId,
        parentJobId: body.parentJobId ?? null,
        correlationId,
      },
      logger,
    )
    const insertedJmrs = await insertJmrRows(
      service,
      jobId,
      body.marketIds,
      accountMap,
      logger,
    )

    await appendAudit({
      category: 'registration',
      event: 'registration.start',
      sellerId,
      meta: {
        jobId,
        productId: body.productId,
        marketIds: body.marketIds,
        parentJobId: body.parentJobId ?? null,
      },
      correlationId,
      logger,
    })

    // worker fan-out (fire-and-forget). 응답을 기다리지 않음 → start 의 timeout 영향 없음.
    for (const jmr of insertedJmrs) {
      invokeMarketWorker({
        jobId,
        marketId: jmr.market_id as MarketId,
        marketResultId: jmr.id,
        correlationId,
        logger,
      })
    }

    return ok(
      {
        jobId,
        status: 'pending' as const,
        marketResults: insertedJmrs.map((jmr) => ({
          marketResultId: jmr.id,
          marketId: jmr.market_id,
          marketAccountId: jmr.market_account_id,
          status: 'pending' as const,
        })),
      },
      { status: 201, correlationId },
    )
  }),
)
