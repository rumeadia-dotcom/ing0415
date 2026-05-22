/**
 * Mock Supabase client (`useMock=true` 진입 시 사용).
 *
 * 실제 SupabaseClient API 중 코드에서 호출되는 표면만 흉내낸다:
 *   - auth: getSession / signInWithPassword / signUp / signOut / resetPasswordForEmail
 *           / updateUser / onAuthStateChange
 *   - from(table).select().eq().single() 등 chainable QueryBuilder
 *   - rpc(name, args)
 *   - channel(name).on().subscribe() (no-op)
 *   - functions.invoke(name, opts) (no-op success)
 *
 * 데이터는 `./fixtures` 의 in-memory 배열을 직접 참조. mutating 액션 (insert/update)
 * 은 배열에 push/patch 한다. 새로고침해도 유지되도록 sessionStorage 동기화는 v2.
 *
 * 본 모듈은 dev + useMock=true 에서만 임포트된다. Vite tree-shaking 으로 real 번들
 * 에서는 제거.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  MOCK_SELLER_ID,
  mockDashboardSummary,
  mockLogenCredentials,
  mockMarketAccounts,
  mockOrders,
  mockProducts,
  mockRegistrationJobMarketResults,
  mockRegistrationJobs,
  mockSellerUser,
  mockSession,
  mockShippingJobMarketResults,
  mockShippingJobs,
  mockShippingPolicies,
  mockSellerShippingSettings,
} from './fixtures'

type AuthChangeCallback = (event: string, session: typeof mockSession | null) => void

// orders_with_dispatch_summary view 의 단일 row
function buildOrdersDispatchSummaryRow() {
  const byMarket: Record<
    string,
    { market_id: string; new_orders_count: number; pending_count: number }
  > = {}
  let newOrders = 0
  let logenRegistered = 0
  let waybillPending = 0
  let dispatchSubmitted = 0
  for (const o of mockOrders) {
    const mid = String(o.market_id)
    if (!byMarket[mid]) byMarket[mid] = { market_id: mid, new_orders_count: 0, pending_count: 0 }
    if (o.status === 'collected') {
      byMarket[mid].new_orders_count += 1
      newOrders += 1
    }
    if (o.status === 'logen_registered') logenRegistered += 1
    if (o.status === 'waybill_printed') waybillPending += 1
    if (o.status === 'tracking_submitted') dispatchSubmitted += 1
    if (o.status !== 'tracking_submitted') byMarket[mid].pending_count += 1
  }
  return {
    seller_id: MOCK_SELLER_ID,
    new_orders_count: newOrders,
    logen_registered_count: logenRegistered,
    waybill_pending_count: waybillPending,
    dispatch_submitted_count: dispatchSubmitted,
    by_market: Object.values(byMarket),
  }
}

const TABLES: Record<string, any[]> = {
  market_accounts: mockMarketAccounts,
  products: mockProducts,
  registration_jobs: mockRegistrationJobs,
  registration_job_market_results: mockRegistrationJobMarketResults,
  orders: mockOrders,
  orders_with_dispatch_summary: [buildOrdersDispatchSummaryRow()],
  shipping_jobs: mockShippingJobs,
  shipping_jobs_with_summary: mockShippingJobs,
  shipping_job_market_results: mockShippingJobMarketResults,
  shipping_policies: mockShippingPolicies,
}

let currentSession: typeof mockSession | null = null
const authListeners: AuthChangeCallback[] = []

function dispatchAuth(event: string, session: typeof mockSession | null) {
  for (const cb of authListeners) {
    try {
      cb(event, session)
    } catch (e) {
      console.error('[mock] auth listener error', e)
    }
  }
}

function makeAuth() {
  return {
    async getSession() {
      return { data: { session: currentSession }, error: null }
    },
    async getUser() {
      return { data: { user: currentSession?.user ?? null }, error: null }
    },
    async signInWithPassword(_: { email: string; password: string }) {
      currentSession = mockSession
      // setTimeout to mimic async + after returning from signIn
      setTimeout(() => dispatchAuth('SIGNED_IN', currentSession), 0)
      return { data: { session: currentSession, user: mockSellerUser }, error: null }
    },
    async signUp(_: { email: string; password: string; options?: any }) {
      currentSession = mockSession
      setTimeout(() => dispatchAuth('SIGNED_IN', currentSession), 0)
      return { data: { session: currentSession, user: mockSellerUser }, error: null }
    },
    async signOut(_?: { scope?: string }) {
      currentSession = null
      setTimeout(() => dispatchAuth('SIGNED_OUT', null), 0)
      return { error: null }
    },
    async resetPasswordForEmail(_: string, __?: any) {
      return { data: {}, error: null }
    },
    async updateUser(_: any) {
      return { data: { user: mockSellerUser }, error: null }
    },
    onAuthStateChange(cb: AuthChangeCallback) {
      authListeners.push(cb)
      // immediate snapshot like Supabase
      setTimeout(() => cb(currentSession ? 'INITIAL_SESSION' : 'INITIAL_SESSION', currentSession), 0)
      return {
        data: {
          subscription: {
            id: 'mock-sub',
            callback: cb,
            unsubscribe: () => {
              const i = authListeners.indexOf(cb)
              if (i >= 0) authListeners.splice(i, 1)
            },
          },
        },
      }
    },
  }
}

// ─── QueryBuilder ────────────────────────────────────────────────────────────
// chainable: .select(cols).eq(col, val).order().limit().range().single().maybeSingle()

interface BuilderState {
  table: string
  rows: any[]
  filters: ((r: any) => boolean)[]
  ordering: { col: string; ascending: boolean } | null
  limitN: number | null
  rangeFrom: number | null
  rangeTo: number | null
  selectMode: 'list' | 'single' | 'maybeSingle' | 'mutateReturn'
  mutate: { kind: 'insert' | 'update' | 'delete'; payload?: any } | null
}

function createBuilder(table: string): any {
  const baseRows = TABLES[table] ?? []
  const state: BuilderState = {
    table,
    rows: baseRows,
    filters: [],
    ordering: null,
    limitN: null,
    rangeFrom: null,
    rangeTo: null,
    selectMode: 'list',
    mutate: null,
  }

  function apply(): any[] {
    let out = state.rows.filter((r) => state.filters.every((f) => f(r)))
    if (state.ordering) {
      const { col, ascending } = state.ordering
      out = [...out].sort((a, b) => {
        const av = a[col]
        const bv = b[col]
        if (av === bv) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1)
      })
    }
    if (state.rangeFrom != null && state.rangeTo != null) {
      out = out.slice(state.rangeFrom, state.rangeTo + 1)
    }
    if (state.limitN != null) out = out.slice(0, state.limitN)
    return out
  }

  const builder: any = {
    select(_?: string, _opts?: any) {
      return builder
    },
    eq(col: string, val: any) {
      state.filters.push((r) => r[col] === val)
      return builder
    },
    neq(col: string, val: any) {
      state.filters.push((r) => r[col] !== val)
      return builder
    },
    in(col: string, vals: any[]) {
      state.filters.push((r) => vals.includes(r[col]))
      return builder
    },
    gte(col: string, val: any) {
      state.filters.push((r) => r[col] >= val)
      return builder
    },
    lte(col: string, val: any) {
      state.filters.push((r) => r[col] <= val)
      return builder
    },
    gt(col: string, val: any) {
      state.filters.push((r) => r[col] > val)
      return builder
    },
    lt(col: string, val: any) {
      state.filters.push((r) => r[col] < val)
      return builder
    },
    is(col: string, val: any) {
      state.filters.push((r) => r[col] === val)
      return builder
    },
    not(col: string, _op: string, val: any) {
      state.filters.push((r) => r[col] !== val)
      return builder
    },
    or(_expr: string) {
      // 단순화: or 필터는 무시 (모든 행 통과)
      return builder
    },
    ilike(col: string, pattern: string) {
      const re = new RegExp(
        '^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$',
        'i',
      )
      state.filters.push((r) => typeof r[col] === 'string' && re.test(r[col]))
      return builder
    },
    order(col: string, opts?: { ascending?: boolean }) {
      state.ordering = { col, ascending: opts?.ascending ?? true }
      return builder
    },
    limit(n: number) {
      state.limitN = n
      return builder
    },
    range(from: number, to: number) {
      state.rangeFrom = from
      state.rangeTo = to
      return builder
    },
    single() {
      state.selectMode = 'single'
      return builder.then ? builder : Promise.resolve(builder._resolve()).then((v) => v)
    },
    maybeSingle() {
      state.selectMode = 'maybeSingle'
      return builder.then ? builder : Promise.resolve(builder._resolve()).then((v) => v)
    },
    insert(payload: any) {
      state.mutate = { kind: 'insert', payload }
      return builder
    },
    update(payload: any) {
      state.mutate = { kind: 'update', payload }
      return builder
    },
    delete() {
      state.mutate = { kind: 'delete' }
      return builder
    },
    upsert(payload: any) {
      state.mutate = { kind: 'insert', payload } // simplified
      return builder
    },
    _resolve(): any {
      // mutating ops
      if (state.mutate) {
        if (state.mutate.kind === 'insert') {
          const rows = Array.isArray(state.mutate.payload)
            ? state.mutate.payload
            : [state.mutate.payload]
          for (const r of rows) {
            if (!r.id) r.id = crypto.randomUUID()
            state.rows.push(r)
          }
          if (state.selectMode === 'single' || state.selectMode === 'maybeSingle') {
            return { data: rows[0], error: null }
          }
          return { data: rows, error: null }
        }
        if (state.mutate.kind === 'update') {
          const matched = apply()
          for (const r of matched) Object.assign(r, state.mutate.payload)
          if (state.selectMode === 'single' || state.selectMode === 'maybeSingle') {
            return { data: matched[0] ?? null, error: null }
          }
          return { data: matched, error: null }
        }
        if (state.mutate.kind === 'delete') {
          const matched = apply()
          for (const r of matched) {
            const idx = state.rows.indexOf(r)
            if (idx >= 0) state.rows.splice(idx, 1)
          }
          return { data: matched, error: null }
        }
      }
      // read ops
      const rows = apply()
      if (state.selectMode === 'single') {
        if (rows.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
        }
        return { data: rows[0], error: null }
      }
      if (state.selectMode === 'maybeSingle') {
        return { data: rows[0] ?? null, error: null }
      }
      return { data: rows, error: null, count: rows.length }
    },
    then(onFulfilled: any, onRejected: any) {
      const result = builder._resolve()
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
  }
  return builder
}

// ─── RPC 핸들러 ──────────────────────────────────────────────────────────────

function handleRpc(name: string, args: Record<string, any> = {}): any {
  switch (name) {
    case 'rpc_get_dashboard_summary':
      return { data: mockDashboardSummary, error: null }

    case 'list_orders': {
      const filtered = mockOrders.filter(
        (o) => !args['p_market_id'] || o.market_id === args['p_market_id'],
      )
      const total = filtered.length
      const limit = args['p_limit'] ?? 50
      const sliced = filtered.slice(0, limit)
      // RawOrderRowSchema shape 으로 매핑
      const data = sliced.map((o) => ({
        id: o.id,
        external_order_id: o.external_order_id,
        market_id: o.market_id,
        product_name: o.product_name,
        buyer_masked_name: o.buyer_name.slice(0, 1) + '*'.repeat(Math.max(1, o.buyer_name.length - 1)),
        shipping_status: o.status,
        market_dispatch_status: o.status === 'tracking_submitted' ? 'submitted' : 'pending',
        waybill_number: o.waybill_number,
        ordered_at: o.collected_at,
        updated_at: o.created_at,
        total_count: total,
      }))
      return { data, error: null }
    }
    case 'get_order': {
      const o = mockOrders.find((x) => x.id === args['p_order_id'])
      if (!o) return { data: null, error: null }
      return {
        data: {
          order: {
            id: o.id,
            seller_id: MOCK_SELLER_ID,
            external_order_id: o.external_order_id,
            market_id: o.market_id,
            product_name: o.product_name,
            product_option: null,
            quantity: o.quantity,
            buyer_masked_name: o.buyer_name.slice(0, 1) + '**',
            buyer_masked_phone: '010-****-5678',
            shipping_address_masked: '서울특별시 강남구 ****',
            shipping_status: o.status,
            market_dispatch_status:
              o.status === 'tracking_submitted' ? 'submitted' : 'pending',
            waybill_number: o.waybill_number,
            logen_error_message: o.status === 'logen_failed' ? '로젠 SDK timeout (mock)' : null,
            ordered_at: o.collected_at,
            collected_at: o.collected_at,
            logen_registered_at: ['logen_registered', 'waybill_printed', 'tracking_submitted'].includes(o.status)
              ? o.collected_at
              : null,
            waybill_printed_at: ['waybill_printed', 'tracking_submitted'].includes(o.status)
              ? o.collected_at
              : null,
            tracking_submitted_at: o.status === 'tracking_submitted' ? o.collected_at : null,
            updated_at: o.created_at,
          },
        },
        error: null,
      }
    }
    case 'list_registration_jobs': {
      const filtered = mockRegistrationJobs
      const total = filtered.length
      const limit = args['p_limit'] ?? 50
      const data = filtered.slice(0, limit).map((j) => {
        const results = mockRegistrationJobMarketResults.filter((r) => r.job_id === j.id)
        return {
          id: j.id,
          status: j.status,
          created_at: j.created_at,
          started_at: j.created_at,
          completed_at: j.completed_at,
          retry_count: 0,
          error_summary: j.failed_count > 0 ? `${j.failed_count}건 실패` : null,
          parent_job_id: null,
          product_id: j.product_id,
          product_name: j.product_name,
          product_thumbnail_id: null,
          market_summary: results.map((r) => ({
            market_id: r.market_id,
            // mock fixture status (succeeded/failed/running) → market_result_status enum
            market_status:
              r.status === 'succeeded'
                ? 'success'
                : r.status === 'running'
                  ? 'in_flight'
                  : r.status === 'failed'
                    ? 'failed'
                    : 'pending',
            excluded: false,
          })),
          total_count: total,
        }
      })
      return { data, error: null }
    }
    case 'get_registration_job': {
      const job = mockRegistrationJobs.find((j) => j.id === args['p_job_id'])
      if (!job) return { data: null, error: null }
      const results = mockRegistrationJobMarketResults.filter((r) => r.job_id === job.id)
      const product = mockProducts.find((p) => p.id === job.product_id)
      return {
        data: {
          // job 블록만 snake_case (frontend 가 변환)
          job: {
            id: job.id,
            seller_id: MOCK_SELLER_ID,
            product_id: job.product_id,
            status: job.status,
            created_at: job.created_at,
            started_at: job.created_at,
            completed_at: job.completed_at,
            retry_count: 0,
            error_summary: job.failed_count > 0 ? `${job.failed_count}건 실패` : null,
            cancelled_at: null,
            parent_job_id: null,
            correlation_id: '00000000-0000-4000-8000-000000099999',
          },
          // 나머지는 camelCase
          cancelledByMaskedId: null,
          product: {
            id: product?.id ?? job.product_id,
            name: product?.name ?? job.product_name,
            thumbnailImageId: null,
          },
          parent: null,
          children: [],
          marketResults: results.map((r) => ({
            id: r.id,
            marketId: r.market_id,
            marketStatus:
              r.status === 'succeeded'
                ? 'success'
                : r.status === 'running'
                  ? 'in_flight'
                  : r.status === 'failed'
                    ? 'failed'
                    : 'pending',
            externalProductId: r.external_product_id,
            productUrl: r.external_product_id
              ? `https://${r.market_id}.example.com/${r.external_product_id}`
              : null,
            errorCode: r.error_code,
            errorMessage: r.error_message,
            attemptCount: r.status === 'failed' ? 1 : 0,
            lastAttemptedAt: r.completed_at ?? r.started_at,
            excluded: false,
            updatedAt: r.completed_at ?? r.started_at,
          })),
        },
        error: null,
      }
    }
    case 'get_logen_credentials_status':
      // LogenCredentialsStatusSchema 매핑 (camelCase 응답)
      return { data: mockLogenCredentials, error: null }
    case 'set_logen_credentials':
      return { data: { ok: true }, error: null }
    case 'get_seller_auto_dispatch':
      return { data: mockSellerShippingSettings.auto_dispatch_enabled, error: null }
    case 'set_seller_auto_dispatch': {
      mockSellerShippingSettings.auto_dispatch_enabled = args['p_auto_dispatch'] ?? true
      return { data: null, error: null }
    }
    case 'manual_resolve_waybill':
      return { data: { ok: true }, error: null }
    default:
      return {
        data: null,
        error: { message: `[mock] unknown RPC: ${name}` },
      }
  }
}

// ─── Channel (realtime no-op) ────────────────────────────────────────────────

function createChannel(_name: string) {
  const ch: any = {
    on(_event: string, _filter: any, _cb: any) {
      return ch
    },
    subscribe(cb?: (status: string) => void) {
      if (cb) setTimeout(() => cb('SUBSCRIBED'), 0)
      return ch
    },
    unsubscribe() {
      return Promise.resolve('ok')
    },
  }
  return ch
}

// ─── Functions.invoke (no-op success) ───────────────────────────────────────

function makeFunctions() {
  return {
    async invoke(_name: string, _opts?: any) {
      return { data: { ok: true }, error: null }
    },
  }
}

// ─── Storage (no-op) ─────────────────────────────────────────────────────────

function makeStorage() {
  return {
    from(_bucket: string) {
      return {
        async upload(_path: string, _file: any, _opts?: any) {
          return { data: { path: 'mock://uploaded' }, error: null }
        },
        async createSignedUrl(_path: string, _expiresIn: number) {
          return {
            data: { signedUrl: 'https://mock.local/signed' },
            error: null,
          }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://mock.local/public/${path}` } }
        },
      }
    },
  }
}

// ─── 진입 ───────────────────────────────────────────────────────────────────

export function createMockSupabase(): any {
  // 부팅 시점에 자동 로그인 상태로 시작 (UI 즉시 진입)
  currentSession = mockSession

  return {
    auth: makeAuth(),
    from: (table: string) => createBuilder(table),
    rpc: (name: string, args?: Record<string, any>) => createRpcBuilder(name, args),
    channel: (name: string) => createChannel(name),
    removeChannel: (_ch: any) => Promise.resolve('ok'),
    functions: makeFunctions(),
    storage: makeStorage(),
    _mock: { sellerId: MOCK_SELLER_ID },
  }
}

// RPC 응답을 thenable + chainable 로 반환 (Supabase 호환 — `.maybeSingle()` 등 chain 가능)
function createRpcBuilder(name: string, args?: Record<string, any>): any {
  const result = handleRpc(name, args ?? {})
  // result.data 가 배열이면 chain (single/maybeSingle/limit/order 등) 가능해야 함
  const b: any = {
    single() {
      if (Array.isArray(result.data)) {
        if (result.data.length === 0)
          return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
        return Promise.resolve({ data: result.data[0], error: result.error })
      }
      return Promise.resolve(result)
    },
    maybeSingle() {
      if (Array.isArray(result.data)) {
        return Promise.resolve({ data: result.data[0] ?? null, error: result.error })
      }
      return Promise.resolve(result)
    },
    limit(_n: number) {
      return b
    },
    order(_col: string, _opts?: any) {
      return b
    },
    eq(_col: string, _val: any) {
      return b
    },
    select(_cols?: string) {
      return b
    },
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
  }
  return b
}
