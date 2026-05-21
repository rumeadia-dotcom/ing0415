/**
 * Edge Function: shipping-dispatch-job
 *
 * 마스터 (의존, 본 PR 범위 외 정의):
 *   - docs/spec/PRD-v2-shipping.md §2.4 (스펙 작성 예정)
 *   - docs/spec/user_flow-v2-shipping.md s8 n53/n54/n55/n56
 *   - PR2: shipping_jobs / shipping_job_results / orders 마이그레이션
 *   - PR4: MarketAdapter.submitTracking 구현
 *
 * 책임:
 *   - 셀러가 "송장 일괄 제출" 클릭 시 호출.
 *   - 흐름:
 *     1) JWT 검증 → 셀러 ID 추출
 *     2) request validation (orderIds optional)
 *     3) preflight: dispatchable orders 로드 (status='waybill_printed') + 그룹화
 *     4) shipping_jobs INSERT + shipping_job_results INSERT (마켓별 N개)
 *     5) status: pending → running
 *     6) shipping-dispatch-market-worker 마켓당 1회 fire-and-forget invoke
 *     7) 응답 202 { jobId, status: 'running', perMarket[] }
 *
 * 강제:
 *   - sellerId == JWT 사용자 ID 일치 검증 (request 의 sellerId 는 reference, JWT 가 진실).
 *   - 마켓별 워커 invoke 는 fire-and-forget (parent timeout 회피).
 *   - 한 마켓 worker invoke 실패가 다른 마켓 진행을 막지 않음 (워커 자체가 격리).
 *   - service_role 사용. seller_id 명시 WHERE 강제.
 *   - 한 주문 → 한 result row. 중복 트리거는 PR2 의 unique constraint 가 담당.
 */

import { z } from 'npm:zod@3.23.8'
import {
  appendAudit,
  getServiceClient,
  getUserClient,
  HttpErrors,
  ok,
  parseBody,
  requireBearer,
  UuidSchema,
  withRequest,
} from '../_shared/index.ts'
import {
  groupOrdersByMarket,
  loadDispatchableOrders,
} from './lib/preflight.ts'
import {
  insertShippingJob,
  insertShippingJobResults,
  markShippingJobRunning,
} from './lib/insert.ts'
import { invokeShippingMarketWorker } from './lib/invoke-market-worker.ts'
import type { PerMarketSummary } from './lib/types.ts'

const RequestSchema = z.object({
  sellerId: UuidSchema,
  orderIds: z.array(UuidSchema).min(1).max(500).optional(),
})

export default Deno.serve(
  withRequest('shipping-dispatch-job', async ({ req, logger, correlationId }) => {
    const jwt = requireBearer(req)
    const body = await parseBody(req, RequestSchema)

    const userClient = getUserClient(jwt)
    const userRes = await userClient.auth.getUser()
    if (userRes.error || !userRes.data.user) {
      throw HttpErrors.unauthorized('invalid_token', 'jwt verification failed')
    }
    const sellerId = userRes.data.user.id

    if (sellerId !== body.sellerId) {
      throw HttpErrors.forbidden(
        'seller_mismatch',
        'request sellerId does not match JWT subject',
      )
    }

    logger.info(
      {
        event: 'shipping_dispatch_start',
        sellerId,
        orderIdsCount: body.orderIds?.length ?? 0,
        correlationId,
      },
      '→ shipping dispatch start',
    )

    const service = getServiceClient()

    // 1) Preflight: dispatchable orders.
    const orders = await loadDispatchableOrders(
      service,
      sellerId,
      body.orderIds,
      logger,
    )

    if (orders.length === 0) {
      throw HttpErrors.badRequest(
        'no_dispatchable_orders',
        'no orders in waybill_printed status',
      )
    }

    // 2) 마켓별 그룹화.
    const perMarket = groupOrdersByMarket(orders)

    // 3) shipping_jobs + shipping_job_results INSERT.
    //    PRD §4: shipping_jobs.order_count = orders.length (preflight 결과).
    const jobId = await insertShippingJob(
      service,
      { sellerId, orderCount: orders.length, correlationId },
      logger,
    )
    await insertShippingJobResults(service, jobId, orders, logger)
    await markShippingJobRunning(service, jobId)

    await appendAudit({
      category: 'shipping',
      event: 'shipping.dispatch_start',
      sellerId,
      meta: {
        jobId,
        totalOrders: orders.length,
        marketCount: perMarket.size,
        markets: Array.from(perMarket.keys()),
      },
      correlationId,
      logger,
    })

    // 4) 마켓별 워커 fan-out (fire-and-forget).
    const summary: PerMarketSummary[] = []
    for (const [marketId, orderIds] of perMarket.entries()) {
      invokeShippingMarketWorker({
        jobId,
        marketId,
        orderIds,
        correlationId,
        logger,
      })
      summary.push({
        marketId,
        total: orderIds.length,
        invoked: true,
      })
    }

    return ok(
      {
        jobId,
        status: 'running' as const,
        perMarket: summary,
      },
      { status: 202, correlationId },
    )
  }),
)
