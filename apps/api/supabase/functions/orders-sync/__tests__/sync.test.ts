/**
 * orders-sync 통합 테스트 (Deno test).
 *
 * 실행:
 *   deno test --allow-env --allow-read \
 *     apps/api/supabase/functions/orders-sync/__tests__/sync.test.ts
 *
 * 커버리지:
 *   1) happy path — 4 마켓 어댑터 모두 orders 반환 → upsert → 신규 id 수집.
 *   2) 중복 방지 — 동일 (market, external_order_id, seller) 재실행 시 inserted=0, duplicates=N.
 *   3) 한 마켓 실패 격리 — coupang throw 해도 나머지 3 마켓은 정상 진행.
 *   4) sellerId 필터 — 특정 셀러만 polling.
 *   5) fetchOrders 미 부착 어댑터 (PR4 미 머지 시나리오) → skip + errorCode 'adapter_no_fetch_orders'.
 *   6) logen invoke fire-and-forget — 실패해도 outcome 정상 반환.
 *   7) non-new_pay status 필터 — 어댑터가 'dispatched' 등 반환 시 적재 제외.
 *
 * 강제:
 *   - 실 Supabase 호출 없음. in-memory mock SupabaseClient 사용.
 *   - PR4 `market-orders.ts` MarketOrderSchema 1:1 매핑 검증.
 *   - PRD §4 컬럼 (buyer_name / receiver_* / product_name / quantity / order_amount /
 *     status='collected' / collected_at) 매핑 검증.
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { syncOrders } from '../lib/sync.ts'
import type {
  MarketOrder,
  MarketOrderStatus,
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
  buyer_name: string
  receiver_name: string
  receiver_address: string
  receiver_phone: string
  product_name: string
  quantity: number
  order_amount: number
  status: string
  collected_at: string
}

interface MockState {
  accounts: AccountRow[]
  orders: OrderRow[]
  nextOrderSeq: number
}

function makeMockSupabase(state: MockState) {
  function tableAccounts() {
    let filtered = state.accounts.slice()
    const chain = {
      select: (_cols: string) => chain,
      eq: (col: string, val: unknown) => {
        filtered = filtered.filter(
          (r) => (r as unknown as Record<string, unknown>)[col] === val,
        )
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
        rows: Omit<OrderRow, 'id'>[],
        opts: { onConflict: string; ignoreDuplicates: boolean },
      ) => {
        if (opts.onConflict !== 'market_id,external_order_id,seller_id') {
          throw new Error(`unexpected onConflict: ${opts.onConflict}`)
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
// 테스트 헬퍼 — PR4 MarketOrderSchema 1:1
// ─────────────────────────────────────────────

const SELLER_A = '00000000-0000-0000-0000-00000000000a'
const SELLER_B = '00000000-0000-0000-0000-00000000000b'

function makeOrder(
  marketId: MarketId,
  externalOrderId: string,
  status: MarketOrderStatus = 'new_pay',
): MarketOrder {
  return {
    externalOrderId,
    buyerName: '홍길동',
    receiverName: '수령자',
    receiverAddress: '서울시 강남구 ...',
    receiverPhone: '010-0000-0000',
    productName: '테스트 상품',
    quantity: 1,
    orderAmount: 10000,
    status,
    paidAt: '2026-05-20T10:00:00+09:00',
    market: marketId,
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

  // PRD §4 컬럼 매핑 검증 — 첫 row.
  const sample = state.orders[0]
  assertExists(sample)
  assertEquals(sample.status, 'collected')
  assertEquals(sample.buyer_name, '홍길동')
  assertEquals(sample.receiver_name, '수령자')
  assertEquals(sample.product_name, '테스트 상품')
  assertEquals(sample.quantity, 1)
  assertEquals(sample.order_amount, 10000)
  assertEquals(sample.collected_at, '2026-05-20T10:00:00+09:00')
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
  const adapters: Partial<Record<MarketId, OrderSyncAdapter>> = {
    naver: {
      async fetchOrders() {
        return Promise.resolve([makeOrder('naver', `NV-${Date.now()}`)])
      },
    },
  }
  const outcome = await syncOrders(
    { sellerId: SELLER_A },
    makeDeps(state, adapters),
  )
  assertEquals(outcome.collected, 1)
  assertEquals(outcome.newOrderIds.length, 1)
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
  const failingDeps = {
    ...deps,
    invokeLogenShipment: () => {
      throw new Error('logen-register-shipment not deployed (PR6 미 머지)')
    },
  }
  const outcome = await syncOrders({}, failingDeps)
  assertEquals(outcome.collected, 1)
  assertEquals(outcome.newOrderIds.length, 1)
  assertEquals(outcome.errors.length, 0)
})

// ─────────────────────────────────────────────
// 7) non-new_pay status 필터
// ─────────────────────────────────────────────

Deno.test('orders-sync: 어댑터가 non-new_pay status 반환 시 적재 제외', async () => {
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
      orders: [
        makeOrder('naver', 'NV-NEW', 'new_pay'),
        makeOrder('naver', 'NV-DISP', 'dispatched'),
        makeOrder('naver', 'NV-DEL', 'delivered'),
      ],
    }),
  }
  const outcome = await syncOrders({}, makeDeps(state, adapters))

  // 'new_pay' 1건만 적재. 나머지 2건은 부적격 제외.
  assertEquals(outcome.collected, 1)
  assertEquals(outcome.newOrderIds.length, 1)
  assertEquals(state.orders.length, 1)
  assertEquals(state.orders[0]?.external_order_id, 'NV-NEW')
})
