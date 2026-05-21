/**
 * Edge Function: orders-sync
 *
 * 마스터 (예정):
 *   - PRD-v2-shipping.md §2.1 (자동 처리 트리거)
 *   - user_flow-v2-shipping.md s8 n51
 *
 * 책임:
 *   - body: `{ sellerId?: string }` (없으면 모든 활성 셀러 순회)
 *   - 4 마켓 (naver / coupang / gmarket / auction) 활성 market_accounts 조회
 *   - 각 어댑터 `fetchOrders` 호출 (지난 24h, status='결제완료')
 *   - orders 테이블 upsert (UNIQUE(seller_id, market_id, external_order_id) on conflict do nothing)
 *   - 새로 insert 된 orders.id → logen-register-shipment Edge Function invoke (PR6)
 *   - 응답 `{ collected, perMarket, errors, newOrderIds }`
 *
 * 호출자:
 *   - pg_cron 10분 간격 (마이그레이션 20260521000010_pg_cron_orders_sync.sql)
 *   - 수동 트리거 시 Authorization: Bearer service_role
 *
 * 강제:
 *   - service_role 인증만 허용 (RLS bypass + cron 단일 경로).
 *   - 한 마켓 실패가 다른 마켓 진행을 막지 않는다.
 *   - 평문 토큰·PII 절대 로그/응답 노출 금지.
 *   - 본 함수 자체는 fetch + invoke 만. 송장 등록·제출은 PR6 / PR7.
 *
 * 의존 (PR 머지 순서):
 *   - PR2: orders 테이블 + UNIQUE 제약.
 *   - PR4: MarketAdapter.fetchOrders (OrderSyncAdapter 확장).
 *   - PR6: logen-register-shipment Edge Function.
 *   본 PR 단독 머지 시: fetchOrders 미 부착 → 어댑터 shape check 가 skip 처리.
 */

import { z } from 'npm:zod@3.23.8'
import {
  env,
  getServiceClient,
  HttpErrors,
  ok,
  parseBody,
  withRequest,
} from '../_shared/index.ts'
import { makeLogenInvoker, syncOrders } from './lib/sync.ts'

const RequestSchema = z.object({
  sellerId: z.string().uuid().optional(),
  /** pg_cron 호환 — 기본 'cron'. 수동 트리거 시 'manual'. */
  source: z.enum(['cron', 'manual']).default('cron'),
})

function isServiceRoleCall(req: Request): boolean {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return false
  const token = auth.slice('bearer '.length).trim()
  return token === env.SUPABASE_SERVICE_ROLE_KEY
}

export default Deno.serve(
  withRequest('orders-sync', async ({ req, logger, correlationId }) => {
    if (req.method !== 'POST') {
      throw HttpErrors.badRequest('method_not_allowed', 'POST required')
    }
    if (!isServiceRoleCall(req)) {
      throw HttpErrors.forbidden(
        'forbidden',
        'orders-sync requires service_role',
      )
    }

    const body = await parseBody(req, RequestSchema)
    const supabase = getServiceClient()

    // logen invoke URL 도출 — Supabase Edge Functions base URL.
    // (SUPABASE_URL 의 host 를 functions 도메인으로 치환.)
    const functionsBaseUrl = (() => {
      try {
        const u = new URL(env.SUPABASE_URL)
        return `${u.protocol}//${u.host}/functions/v1`
      } catch {
        return env.SUPABASE_URL
      }
    })()

    const outcome = await syncOrders(
      { sellerId: body.sellerId },
      {
        supabase,
        logger,
        correlationId,
        now: new Date(),
        invokeLogenShipment: makeLogenInvoker({
          functionsBaseUrl,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
          logger,
          correlationId,
        }),
      },
    )

    return ok(
      {
        collected: outcome.collected,
        perMarket: outcome.perMarket,
        errors: outcome.errors,
        newOrderIds: outcome.newOrderIds,
        correlationId,
        source: body.source,
      },
      { correlationId },
    )
  }),
)
