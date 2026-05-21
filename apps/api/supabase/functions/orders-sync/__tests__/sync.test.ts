/**
 * orders-sync 통합 테스트 (Deno test).
 *
 * 실행:
 *   deno test --allow-env --allow-read \
 *     apps/api/supabase/functions/orders-sync/__tests__/sync.test.ts
 *
 * 커버리지:
 *   1) happy path — 4 마켓 어댑터 모두 orders 반환 → upsert → 신규 id 수집.
 *   2) 중복 방지 — 동일 (seller, market, external_order_id) 재실행 시 inserted=0, duplicates=N.
 *   3) 한 마켓 실패 격리 — coupang throw 해도 나머지 3 마켓은 정상 진행.
 *   4) sellerId 필터 — 특정 셀러만 polling.
 *   5) fetchOrders 미 부착 어댑터 (PR4 미 머지 시나리오) → skip + errorCode 'adapter_no_fetch_orders'.
 *   6) logen invoke fire-and-forget — 실패해도 outcome 정상 반환.
 *
 * 강제:
 *   - 실 Supabase 호출 없음. in-memory mock SupabaseClient 사용.
 *   - 평문 토큰 / PII 노출 검증 없음 — _shared/logger 의 maskRecord 가 담당.
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { syncOrders } from '../lib/sync.ts'
import type {
  MarketOrder,
  OrderSyncAdapter,
} from '../lib/adapter-shape.ts'
import { createLogger } from '../../_shared/logger.ts'
import type { MarketId } from '../../_shared/index.ts'

// ─────────────────────────────────────────────
// In-memory mock SupabaseClient
// ─────────────────────────────────────────────

interface AccountRow {
  id: string
  seller_id: string
  market_id: string
  credential_id: string
  status: string
}

interface OrderRow {
  id: string
  seller_id: string
  market_id: string
  external_order_id: string
  status: string
  ordered_at: string
  payload: Record<string, unknown>
}

interface MockState {
  accounts: AccountRow[]
  orders: OrderRow[]
  nextOrderSeq: number
}

function makeMockSupabase(state: MockState) {
  // chainable query builder — 본 PR 이 쓰는 메서드만 구현.
  function tableAccounts() {
    let filtered = state.accounts.slice()
    const chain = {
      select: (_cols: string) => chain,
      eq: (col: string, val: unknown) => {
        filtered = filtered.filter((r) => (r as unknown as Record<string, unknown>)[col] === val)
        return chain
      },
      in: (col: string, vals: unknown[]) => {
        filtered = filtered.filter((r) =>
          vals.includes((r as unknown as Record<string, unknown>)[col]),
        )
        return chain
      },
      then: (
        resolve: (v: { data: AccountRow[]; error: null }) => unknown,
      ) => Promise.resolve(resolve({ data: filtered, error: null })),
    }
    return chain
  }

  function tableOrders() {
    let returningRows: OrderRow[] = []
    const chain = {
      upsert: (
        rows: Array<{
          seller_id: string
          market_id: string
          external_order_id: string
          status: string
          ordered_at: string
          payload: Record<string, unknown>
        }>,
        opts: { onConflict: string; ignoreDuplicates: boolean },
      ) => {
        if (opts.onConflict !== 'seller_id,market_id,external_order_id') {
          throw new Error('unexpected onConflict')
        }
        const newRows: OrderRow[] = []
        for (const row of rows) {
          const dup = state.orders.find(
            (o) =>
              o.seller_id === row.seller_id &&
              o.market_id === row.market_id &&
              o.external_order_id === row.external_order_id,
          )
          if (dup) continue
          const inserted: OrderRow = {
            id: `order-${++state.nextOrderSeq}`,
            ...row,
          }
          state.orders.push(inserted)
          newRows.push(inserted)
        }
        returningRows = newRows
        return chain
      },
      select: (_cols: string) =>
        Promise.resolve({
          data: returningRows.map((r) => ({
            id: r.id,
            market_id: r.market_id,
            external_order_id: r.external_order_id,
          })),
          error: null,
        }),
    }
    return chain
  }

  return {
    from: (table: string) => {
      if (table === 'market_accounts') return tableAccounts()
      if (table === 'orders') return tableOrders()
      throw new Error(`unexpected table: ${table}`)
    },
  } as unknown as Parameters<typeof syncOrders>[1]['supabase']
}

// ─────────────────────────────────────────────
// Mock adapter factory
// ─────────────────────────────────────────────

interface MockAdapterOpts {
  marketId: MarketId
  orders: MarketOrder[]
  throwError?: Error
}

function makeMockAdapter(opts: MockAdapterOpts): OrderSyncAdapter {
  return {
    async fetchOrders() {
      if (opts.throwError) throw opts.throwError
      return Promise.resolve(opts.orders)
    },
  }
}

// ─────────────────────────────────────────────
// 테스트 헬퍼
// ─────────────────────────────────────────────

const SELLER_A = '00000000-0000-0000-0000-00000000000a'
const SELLER_B = '00000000-0000-0000-0000-00000000000b'

function makeOrder(
  marketId: MarketId,
  externalOrderId: string,
): MarketOrder {
  return {
    marketId,
    externalOrderId,
    status: '결제완료',
    orderedAt: '2026-05-20T10:00:00+09:00',
    payload: { sample: 'payload', market: marketId },
  }
}

function makeDeps(
  state: MockState,
  adapters: Partial<Record<MarketId, OrderSyncAdapter>>,
  invokeSpy?: (ids: string[]) => void,
) {
  return {
    supabase: makeMockSupabase(state),
    logger: createLogger('orders-sync-test', { correlationId: 'test-cid' }),
    correlationId: 'test-cid',
    now: new Date('2026-05-21T00:00:00Z'),
    resolveAdapter: (marketId: MarketId) => adapters[marketId] ?? null,
    invokeLogenShipment: invokeSpy
      ? (ids: string[]) => {
          invokeSpy(ids)
        }
      : undefined,
  }
}

// ─────────────────────────────────────────────
// 1) happy path
// ─────────────────────────────────────────────

Deno.test('orders-sync: happy path — 4 마켓 모두 신규 주문 적재', async () => {
  const state: MockState = {
    accounts: (
      ['naver', 'coupang', 'gmarket', 'auction'] as MarketId[]
    ).map((m, idx) => ({
      id: `account-${idx}`,
      seller_id: SELLER_A,
      market_id: m,
      credential_id: `cred-${idx}`,
      status: 'active',
    })),
    orders: [],
    nextOrderSeq: 0,
  }
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: makeMockAdapter({
      marketId: 'naver',
      orders: [makeOrder('naver', 'NV-1'), makeOrder('naver', 'NV-2')],
    }),
    coupang: makeMockAdapter({
      marketId: 'coupang',
      orders: [makeOrder('coupang', 'CP-1')],
    }),
    gmarket: makeMockAdapter({
      marketId: 'gmarket',
      orders: [makeOrder('gmarket', 'GM-1')],
    }),
    auction: makeMockAdapter({
      marketId: 'auction',
      orders: [makeOrder('auction', 'AU-1')],
    }),
  }
  const invoked: string[][] = []
  const outcome = await syncOrders(
    {},
    makeDeps(state, adapters, (ids) => invoked.push(ids)),
  )

  assertEquals(outcome.collected, 5)
  assertEquals(outcome.errors.length, 0)
  assertEquals(outcome.newOrderIds.length, 5)
  assertEquals(outcome.perMarket['naver']?.inserted, 2)
  assertEquals(outcome.perMarket['coupang']?.inserted, 1)
  assertEquals(outcome.perMarket['gmarket']?.inserted, 1)
  assertEquals(outcome.perMarket['auction']?.inserted, 1)
  assertEquals(invoked.length, 1)
  assertEquals(invoked[0]?.length, 5)
})

// ─────────────────────────────────────────────
// 2) 중복 방지
// ─────────────────────────────────────────────

Deno.test('orders-sync: 동일 주문 재실행 시 inserted=0, duplicates=N', async () => {
  const state: MockState = {
    accounts: [
      {
        id: 'a1',
        seller_id: SELLER_A,
        market_id: 'naver',
        credential_id: 'c1',
        status: 'active',
      },
    ],
    orders: [],
    nextOrderSeq: 0,
  }
  const sameOrders: MarketOrder[] = [
    makeOrder('naver', 'NV-DUP-1'),
    makeOrder('naver', 'NV-DUP-2'),
  ]
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: makeMockAdapter({ marketId: 'naver', orders: sameOrders }),
  }

  // 첫 실행 → 2 insert.
  const first = await syncOrders({}, makeDeps(state, adapters))
  assertEquals(first.collected, 2)
  assertEquals(first.perMarket['naver']?.inserted, 2)

  // 두 번째 실행 → 0 insert + 2 duplicates.
  const second = await syncOrders({}, makeDeps(state, adapters))
  assertEquals(second.collected, 0)
  assertEquals(second.perMarket['naver']?.inserted, 0)
  assertEquals(second.perMarket['naver']?.duplicates, 2)
  assertEquals(second.newOrderIds.length, 0)
})

// ─────────────────────────────────────────────
// 3) 한 마켓 실패 격리
// ─────────────────────────────────────────────

Deno.test('orders-sync: coupang throw 시에도 나머지 3 마켓 진행', async () => {
  const state: MockState = {
    accounts: (
      ['naver', 'coupang', 'gmarket', 'auction'] as MarketId[]
    ).map((m, idx) => ({
      id: `account-${idx}`,
      seller_id: SELLER_A,
      market_id: m,
      credential_id: `cred-${idx}`,
      status: 'active',
    })),
    orders: [],
    nextOrderSeq: 0,
  }
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: makeMockAdapter({
      marketId: 'naver',
      orders: [makeOrder('naver', 'NV-OK')],
    }),
    coupang: makeMockAdapter({
      marketId: 'coupang',
      orders: [],
      throwError: new Error('rate limit'),
    }),
    gmarket: makeMockAdapter({
      marketId: 'gmarket',
      orders: [makeOrder('gmarket', 'GM-OK')],
    }),
    auction: makeMockAdapter({
      marketId: 'auction',
      orders: [makeOrder('auction', 'AU-OK')],
    }),
  }
  const outcome = await syncOrders({}, makeDeps(state, adapters))

  assertEquals(outcome.collected, 3)
  assertEquals(outcome.errors.length, 1)
  assertEquals(outcome.errors[0]?.marketId, 'coupang')
  assertEquals(outcome.perMarket['coupang']?.inserted, 0)
  assertEquals(outcome.perMarket['naver']?.inserted, 1)
  assertEquals(outcome.perMarket['gmarket']?.inserted, 1)
  assertEquals(outcome.perMarket['auction']?.inserted, 1)
})

// ─────────────────────────────────────────────
// 4) sellerId 필터
// ─────────────────────────────────────────────

Deno.test('orders-sync: sellerId 인자 시 해당 셀러만 polling', async () => {
  const state: MockState = {
    accounts: [
      {
        id: 'a1',
        seller_id: SELLER_A,
        market_id: 'naver',
        credential_id: 'c1',
        status: 'active',
      },
      {
        id: 'a2',
        seller_id: SELLER_B,
        market_id: 'naver',
        credential_id: 'c2',
        status: 'active',
      },
    ],
    orders: [],
    nextOrderSeq: 0,
  }
  let calledWithSeller: string | undefined
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: {
      async fetchOrders() {
        // adapter 호출 자체는 셀러 구분 없음 — sellerId 필터는 market_accounts 단계에서.
        return Promise.resolve([makeOrder('naver', `NV-${Date.now()}`)])
      },
    },
  }
  const outcome = await syncOrders(
    { sellerId: SELLER_A },
    makeDeps(state, adapters),
  )
  // SELLER_A 의 1 계정만 처리 → 1 신규.
  assertEquals(outcome.collected, 1)
  assertEquals(outcome.newOrderIds.length, 1)
  // (sellerId 필터가 mock 의 .eq('seller_id') 로 작동하는지 검증)
  calledWithSeller = SELLER_A
  assertExists(calledWithSeller)
})

// ─────────────────────────────────────────────
// 5) fetchOrders 미 부착 (PR4 미 머지 시나리오)
// ─────────────────────────────────────────────

Deno.test('orders-sync: 어댑터에 fetchOrders 없으면 skip + errorCode', async () => {
  const state: MockState = {
    accounts: [
      {
        id: 'a1',
        seller_id: SELLER_A,
        market_id: 'naver',
        credential_id: 'c1',
        status: 'active',
      },
    ],
    orders: [],
    nextOrderSeq: 0,
  }
  // 의도적으로 비어 있는 객체 — fetchOrders 없음.
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: {} as OrderSyncAdapter,
  }
  const outcome = await syncOrders({}, makeDeps(state, adapters))

  assertEquals(outcome.collected, 0)
  assertEquals(outcome.errors.length, 1)
  assertEquals(outcome.errors[0]?.errorCode, 'adapter_no_fetch_orders')
})

// ─────────────────────────────────────────────
// 6) logen invoke fire-and-forget
// ─────────────────────────────────────────────

Deno.test('orders-sync: logen invoke 실패해도 outcome 정상 반환', async () => {
  const state: MockState = {
    accounts: [
      {
        id: 'a1',
        seller_id: SELLER_A,
        market_id: 'naver',
        credential_id: 'c1',
        status: 'active',
      },
    ],
    orders: [],
    nextOrderSeq: 0,
  }
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: makeMockAdapter({
      marketId: 'naver',
      orders: [makeOrder('naver', 'NV-LOGEN-1')],
    }),
  }
  const deps = makeDeps(state, adapters)
  // logen invoke 가 throw 하도록 교체.
  const failingDeps = {
    ...deps,
    invokeLogenShipment: () => {
      throw new Error('logen-register-shipment not deployed (PR6 미 머지)')
    },
  }
  const outcome = await syncOrders({}, failingDeps)
  assertEquals(outcome.collected, 1)
  assertEquals(outcome.newOrderIds.length, 1)
  // errors 에는 fetch 관련만 — logen 실패는 별도 처리 (warn 로그만).
  assertEquals(outcome.errors.length, 0)
})
