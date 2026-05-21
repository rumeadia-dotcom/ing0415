/**
 * orders-sync 핵심 오케스트레이터.
 *
 * 입력:
 *   - sellerId (optional). 없으면 모든 활성 셀러 순회.
 *   - 어댑터 팩토리 (DI) → mock vs real 모드 통일 진입.
 *   - orders upsert / logen invoke 콜백 (DI).
 *
 * 책임:
 *   1) 활성 market_accounts (status='active') 로드 — 4 마켓 한정 (11번가 제외).
 *   2) credential 복호화 → adapter.fetchOrders 호출 (24h 윈도우, 결제완료).
 *   3) orders upsert (중복 방지) → 새로 들어온 orders.id 수집.
 *   4) 신규 orders → logen-register-shipment 위임 invoke (fire-and-forget).
 *   5) collected / perMarket / errors 집계 반환.
 *
 * 강제:
 *   - 한 마켓 실패가 다른 마켓 진행을 막지 않는다 (try/catch per market).
 *   - 평문 토큰·PII 로그 금지.
 *   - 11번가 (api_key) 는 v1 미사용 — fetch 호출 전 차단.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import {
  getMarketAdapter,
  loadCredential,
  MarketError,
  type Logger,
  type MarketId,
} from '../../_shared/index.ts'
import {
  hasFetchOrders,
  ORDER_SYNC_TARGET_STATUSES,
  type MarketOrder,
  type OrderSyncAdapter,
} from './adapter-shape.ts'
import { upsertOrders } from './orders-repo.ts'

export const ORDER_SYNC_WINDOW_HOURS = 24
/**
 * 폴링 대상 정규화 status.
 *
 * PRD §2.1 "결제완료/배송대기 주문만 수집" — 두 raw 상태가 어댑터 정규화에서
 * `'new_pay'` 한 enum 으로 흡수된다 (PR4 MarketOrderStatusSchema 의 주석 매핑 참고).
 *
 * 어댑터가 raw 한글 상태를 직접 받지 않고 정규화 enum 으로 통신하므로, 본 PR 은
 * 한글 문자열을 다루지 않는다. 향후 "배송대기" 가 별도 enum 으로 분리되면
 * `ORDER_SYNC_TARGET_STATUSES` 배열에 추가만 하면 됨.
 */
export { ORDER_SYNC_TARGET_STATUSES } from './adapter-shape.ts'
const ORDER_SYNC_MARKETS: ReadonlyArray<MarketId> = [
  'naver',
  'coupang',
  'gmarket',
  'auction',
]

export interface MarketAccountRow {
  accountId: string
  sellerId: string
  marketId: MarketId
  credentialId: string
}

export interface PerMarketResult {
  marketId: MarketId
  fetched: number
  inserted: number
  duplicates: number
  errorCode?: string
}

export interface SyncErrorEntry {
  sellerId: string
  marketId: MarketId
  errorCode: string
  errorMessage: string
}

export interface SyncOutcome {
  collected: number
  perMarket: Record<string, PerMarketResult>
  errors: SyncErrorEntry[]
  /** 위임 대상 orders.id (PR6 logen-register-shipment 가 처리). */
  newOrderIds: string[]
}

export interface SyncDeps {
  supabase: SupabaseClient
  logger: Logger
  correlationId: string
  now: Date
  /** adapter 주입 (test 에서 mock fetchOrders 부착). */
  resolveAdapter?: (
    marketId: MarketId,
  ) => OrderSyncAdapter | null
  /** logen invoke 콜백 (테스트에서 spy). */
  invokeLogenShipment?: (orderIds: string[]) => Promise<void> | void
}

// ─────────────────────────────────────────────
// 1) market_accounts 로드
// ─────────────────────────────────────────────

export async function loadActiveAccounts(opts: {
  supabase: SupabaseClient
  sellerId?: string
  logger: Logger
}): Promise<MarketAccountRow[]> {
  let query = opts.supabase
    .from('market_accounts')
    .select('id, seller_id, market_id, credential_id, status')
    .eq('status', 'active')
    .in('market_id', ORDER_SYNC_MARKETS as unknown as string[])

  if (opts.sellerId) {
    query = query.eq('seller_id', opts.sellerId)
  }

  const { data, error } = await query
  if (error) {
    opts.logger.error(
      { rpcError: error.code ?? 'unknown', rpcMessage: error.message },
      '← market_accounts load error',
    )
    return []
  }
  return (data ?? []).map((r) => ({
    accountId: r.id as string,
    sellerId: r.seller_id as string,
    marketId: r.market_id as MarketId,
    credentialId: r.credential_id as string,
  }))
}

// ─────────────────────────────────────────────
// 2) 단일 계정 fetch
// ─────────────────────────────────────────────

async function fetchForAccount(
  account: MarketAccountRow,
  deps: SyncDeps,
): Promise<{ orders: MarketOrder[]; errorCode?: string; errorMessage?: string }> {
  const log = deps.logger.with({
    market: account.marketId,
    sellerId: account.sellerId,
  })

  // adapter resolve — test 에서 주입 가능.
  const adapter = deps.resolveAdapter
    ? deps.resolveAdapter(account.marketId)
    : (getMarketAdapter(account.marketId) as unknown as OrderSyncAdapter | null)

  if (!adapter || !hasFetchOrders(adapter)) {
    log.warn(
      { reason: 'adapter_no_fetch_orders' },
      '← orders-sync skip: adapter without fetchOrders (PR4 가 머지되어야 함)',
    )
    return {
      orders: [],
      errorCode: 'adapter_no_fetch_orders',
      errorMessage: 'adapter does not implement fetchOrders (waiting on PR4)',
    }
  }

  // credential 복호화 — real 모드에서만 의미. test 는 mock adapter 가 자체 처리.
  // PR4 의 fetchOrders 는 credential 을 직접 받지 않음 (sellerId 만). 어댑터는 자체 컨텍스트에서
  // 토큰을 읽도록 설계 (어댑터 인스턴스 생성 시 주입 또는 sellerId → credential 조회).
  // 본 PR 은 real 모드에서 credential 존재 검증만 수행 (load 실패 시 skip).
  if (!deps.resolveAdapter) {
    try {
      await loadCredential({
        credentialId: account.credentialId,
        correlationId: deps.correlationId,
        logger: log,
      })
    } catch (e) {
      const code = e instanceof MarketError ? e.code : 'credential_load_failed'
      log.error({ errorCode: code }, '← credential load failed')
      return {
        orders: [],
        errorCode: code,
        errorMessage: 'credential decrypt failed',
      }
    }
  }

  const since = new Date(
    deps.now.getTime() - ORDER_SYNC_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString()

  log.info(
    {
      method: 'POST',
      since,
      statuses: ORDER_SYNC_TARGET_STATUSES,
    },
    '→ market request',
  )

  try {
    const orders = await adapter.fetchOrders({
      sellerId: account.sellerId,
      since,
      statuses: [...ORDER_SYNC_TARGET_STATUSES],
    })
    log.info({ count: orders.length }, '← market response')
    return { orders }
  } catch (e) {
    const code = e instanceof MarketError ? e.code : 'unknown'
    const message = e instanceof Error ? e.message : String(e)
    log.error({ errorCode: code }, '← market error')
    return { orders: [], errorCode: code, errorMessage: message }
  }
}

// ─────────────────────────────────────────────
// 3) 오케스트레이터 본체
// ─────────────────────────────────────────────

export async function syncOrders(
  opts: {
    sellerId?: string
  },
  deps: SyncDeps,
): Promise<SyncOutcome> {
  const accounts = await loadActiveAccounts({
    supabase: deps.supabase,
    sellerId: opts.sellerId,
    logger: deps.logger,
  })

  deps.logger.info(
    { accountCount: accounts.length, sellerId: opts.sellerId ?? 'all' },
    'orders-sync start',
  )

  const perMarket: Record<string, PerMarketResult> = {}
  const errors: SyncErrorEntry[] = []
  const newOrderIds: string[] = []

  // 한 마켓 실패가 다른 마켓에 영향 없도록 try/catch per account.
  for (const account of accounts) {
    const acc = perMarket[account.marketId] ?? {
      marketId: account.marketId,
      fetched: 0,
      inserted: 0,
      duplicates: 0,
    }
    perMarket[account.marketId] = acc

    const fetched = await fetchForAccount(account, deps)
    if (fetched.errorCode) {
      acc.errorCode = fetched.errorCode
      errors.push({
        sellerId: account.sellerId,
        marketId: account.marketId,
        errorCode: fetched.errorCode,
        errorMessage: fetched.errorMessage ?? '',
      })
      continue
    }
    acc.fetched += fetched.orders.length

    if (fetched.orders.length === 0) continue

    const upsertInputs = fetched.orders.map((o) => ({
      sellerId: account.sellerId,
      marketId: account.marketId,
      order: o,
    }))

    let upsertResults
    try {
      upsertResults = await upsertOrders(
        deps.supabase,
        upsertInputs,
        deps.logger.with({
          market: account.marketId,
          sellerId: account.sellerId,
        }),
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      acc.errorCode = 'orders_upsert_failed'
      errors.push({
        sellerId: account.sellerId,
        marketId: account.marketId,
        errorCode: 'orders_upsert_failed',
        errorMessage: message,
      })
      continue
    }

    for (const r of upsertResults) {
      if (r.insertedId) {
        acc.inserted += 1
        newOrderIds.push(r.insertedId)
      } else {
        acc.duplicates += 1
      }
    }
  }

  // logen 위임 — fire-and-forget. PR6 미 머지 시 invoke 가 404 일 수 있음.
  if (newOrderIds.length > 0 && deps.invokeLogenShipment) {
    try {
      await deps.invokeLogenShipment(newOrderIds)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      deps.logger.warn(
        { invokeErrorMessage: message, orderCount: newOrderIds.length },
        'logen invoke failed (PR6 미 머지 시 정상 — fire-and-forget)',
      )
    }
  }

  const collected = Object.values(perMarket).reduce(
    (sum, m) => sum + m.inserted,
    0,
  )

  deps.logger.info(
    {
      collected,
      perMarket,
      errorCount: errors.length,
      newOrderIds: newOrderIds.length,
    },
    'orders-sync complete',
  )

  return { collected, perMarket, errors, newOrderIds }
}

// ─────────────────────────────────────────────
// 4) logen invoke (운영 진입 — 본 PR 은 placeholder)
// ─────────────────────────────────────────────

export function makeLogenInvoker(opts: {
  functionsBaseUrl: string
  serviceRoleKey: string
  logger: Logger
  correlationId: string
}) {
  return async function invokeLogen(orderIds: string[]): Promise<void> {
    const url = `${opts.functionsBaseUrl.replace(/\/$/, '')}/logen-register-shipment`
    opts.logger.info(
      { url, orderCount: orderIds.length },
      '→ logen-register-shipment invoke',
    )
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.serviceRoleKey}`,
        'content-type': 'application/json',
        'x-correlation-id': opts.correlationId,
      },
      body: JSON.stringify({ orderIds }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      opts.logger.warn(
        {
          status: res.status,
          bodyPreview: body.slice(0, 200),
        },
        '← logen-register-shipment non-2xx (PR6 미 머지 시 정상)',
      )
    } else {
      opts.logger.info(
        { status: res.status },
        '← logen-register-shipment ok',
      )
    }
  }
}
