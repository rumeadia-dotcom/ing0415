/**
 * 4마켓 fan-out 통합 테스트 — 시나리오 빌더.
 *
 * 마스터:
 *   - WIP-5markets-mvp.md C-4 통합 검증
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §6 / §10
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §5 (withRetry)
 *
 * 책임:
 *   - 마켓별 호출 시나리오(성공/지연/401/429/500/timeout)를 attempt 단위로 주입.
 *   - production createMockAdapter 위에 wrapper 를 씌워, attempt 마다 다른 결과를 낼 수 있게 한다.
 *   - production 오케스트레이터(registration-market-worker)와 동등한 로직을 TypeScript 로 재현
 *     (Deno 의존을 Vitest 환경으로 이식하지 않기 위해 — coupang-edge.test.ts 의 패턴과 동일).
 *
 * 비범위 (의식적 제외):
 *   - 실 fetch 호출 / Supabase 호출 / Edge Function 호출. 본 파일은 in-memory 로직만.
 *   - 이미지 변환 파이프라인 (별도 PR).
 *   - DB 잠금 / RLS — pgTAP 영역.
 */

import { vi } from 'vitest'
import { createMockAdapter } from '@/lib/markets/debug/createMockAdapter'
import { MarketError } from '@/lib/markets/errors'
import type { MarketAdapter } from '@/lib/markets/types'
import type {
  AuthInput,
  CreateProductResult,
  MarketId,
  MarketMapping,
  MarketPayload,
  Product,
  TokenSet,
} from '@/lib/schemas'
import {
  CreateProductResultSchema,
  MarketPayloadSchema,
} from '@/lib/schemas'

// ─────────────────────────────────────────────
// 시나리오 정의 — attempt 단위 outcome
// ─────────────────────────────────────────────

/**
 * createProduct 1회 호출 결과.
 *  - 'success'         : MOCK externalId 반환.
 *  - 'success_delay_ms': N ms 지연 후 성공 (병렬성 검증용).
 *  - 'fail_401'        : MarketError('unauthorized') — 재시도 금지.
 *  - 'fail_429'        : MarketError('rate_limit', retryAfterMs=10) — 재시도 가능.
 *  - 'fail_500'        : MarketError('server') — 재시도 가능.
 *  - 'fail_timeout'    : MarketError('network') — 재시도 가능. (실제 60s 대기는 하지 않음 — 카테고리만 동등)
 *  - 'fail_validation' : MarketError('validation') — 재시도 금지. (즉시 failed_final)
 */
export type AttemptOutcome =
  | { kind: 'success' }
  | { kind: 'success_delay_ms'; ms: number }
  | { kind: 'fail_401' }
  | { kind: 'fail_429'; retryAfterMs?: number }
  | { kind: 'fail_500' }
  | { kind: 'fail_timeout' }
  | { kind: 'fail_validation' }

export interface MarketScenario {
  market: MarketId
  /** attempt 1부터 N 까지의 결과 시퀀스. 마지막 항목을 초과하면 마지막 항목을 반복. */
  attempts: AttemptOutcome[]
}

// ─────────────────────────────────────────────
// 시나리오를 주입한 어댑터 wrapper
// ─────────────────────────────────────────────

interface ScenarioAdapter extends MarketAdapter {
  /** 본 어댑터가 받은 createProduct 호출 횟수. */
  readonly callCount: () => number
  /** attempt 마다 outcome 기록 (로깅·검증). */
  readonly outcomeLog: () => AttemptOutcome[]
}

export function createScenarioAdapter(
  scenario: MarketScenario,
): ScenarioAdapter {
  // production createMockAdapter 위에 wrapper. authenticate / transformProduct /
  // fetchCategoryTree 는 그대로 위임. createProduct 만 시나리오 분기.
  const base = createMockAdapter(scenario.market)

  let count = 0
  const log: AttemptOutcome[] = []

  function outcomeFor(attempt: number): AttemptOutcome {
    const idx = Math.min(attempt - 1, scenario.attempts.length - 1)
    const outcome = scenario.attempts[idx]
    if (!outcome) {
      throw new Error(
        `scenario for ${scenario.market} has no attempts defined`,
      )
    }
    return outcome
  }

  const adapter: ScenarioAdapter = {
    market: base.market,
    credentialKind: base.credentialKind,
    authenticate: (input: AuthInput) => base.authenticate(input),
    fetchCategoryTree: () => base.fetchCategoryTree(),
    transformProduct: (product: Product, mapping: MarketMapping) =>
      base.transformProduct(product, mapping),
    createProduct: async (
      payload: MarketPayload,
    ): Promise<CreateProductResult> => {
      // payload 검증 (production 어댑터가 만든 결과 그대로 들어오는지).
      MarketPayloadSchema.parse(payload)
      count += 1
      const outcome = outcomeFor(count)
      log.push(outcome)

      switch (outcome.kind) {
        case 'success':
          return CreateProductResultSchema.parse({
            market: scenario.market,
            externalId: `OK-${scenario.market}-${count}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            productUrl: `https://mock.${scenario.market}.example.com/p/${count}`,
            status: 'succeeded',
            warnings: [],
          })
        case 'success_delay_ms':
          await new Promise((r) => setTimeout(r, outcome.ms))
          return CreateProductResultSchema.parse({
            market: scenario.market,
            externalId: `OK-${scenario.market}-${count}-d${outcome.ms}`,
            productUrl: `https://mock.${scenario.market}.example.com/p/${count}`,
            status: 'succeeded',
            warnings: [],
          })
        case 'fail_401':
          throw new MarketError('unauthorized', 'mock 401', {
            market: scenario.market,
            status: 401,
          })
        case 'fail_429':
          throw new MarketError('rate_limit', 'mock 429', {
            market: scenario.market,
            status: 429,
            retryAfterMs: outcome.retryAfterMs ?? 10,
          })
        case 'fail_500':
          throw new MarketError('server', 'mock 500', {
            market: scenario.market,
            status: 500,
          })
        case 'fail_timeout':
          // 실제 60s 대기는 하지 않고 즉시 network 분류 throw — 카테고리 동등.
          throw new MarketError('network', 'mock timeout', {
            market: scenario.market,
          })
        case 'fail_validation':
          throw new MarketError('validation', 'mock validation', {
            market: scenario.market,
            status: 400,
          })
      }
    },
    callCount: () => count,
    outcomeLog: () => [...log],
  }

  // OAuth 어댑터만 refreshToken 노출 (네이버) — production 정책 유지.
  const baseRefresh = base.refreshToken
  if (baseRefresh) {
    adapter.refreshToken = (refresh: string): Promise<TokenSet> =>
      baseRefresh(refresh)
  }
  return adapter
}

// ─────────────────────────────────────────────
// fetch 가드 — 통합 테스트에서 실 네트워크 호출 발생 시 즉시 fail.
// ─────────────────────────────────────────────

export function installFetchGuard(): () => void {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL) => {
      throw new Error(
        `fetch() blocked in integration test (url=${String(input)})`,
      )
    },
  )
  return () => spy.mockRestore()
}

// ─────────────────────────────────────────────
// JobMarketResult / RegistrationJob in-memory 모델
// 마스터: docs/architecture/v1/cross-cutting/registration-job-state.md §3
// ─────────────────────────────────────────────

export type MarketResultStatus =
  | 'pending'
  | 'in_flight'
  | 'success'
  | 'failed'
  | 'failed_final'

export type JobStatus =
  | 'pending'
  | 'running'
  | 'partial'
  | 'succeeded'
  | 'failed'
  | 'retrying'
  | 'cancelled'

export type JmrErrorCode =
  | 'oauth_expired'
  | 'oauth_revoked'
  | 'rate_limit'
  | 'validation'
  | 'timeout'
  | 'market_5xx'
  | 'image_invalid'
  | 'duplicate'
  | 'quota_exceeded'
  | 'unknown'

export interface JobMarketResult {
  id: string
  jobId: string
  marketId: MarketId
  marketStatus: MarketResultStatus
  externalProductId: string | null
  productUrl: string | null
  errorCode: JmrErrorCode | null
  errorMessage: string | null
  attemptCount: number
  excluded: boolean
  lastAttemptedAt: string | null
}

export interface RegistrationJob {
  id: string
  parentJobId: string | null
  status: JobStatus
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  marketResults: JobMarketResult[]
  /**
   * 상태 전이 audit 로그. 본 배열 길이로 "pending → running → partial 전이 시점"
   * 같은 검증이 가능.
   */
  statusHistory: { at: string; status: JobStatus }[]
}

let __id = 0
function nextId(prefix: string): string {
  __id += 1
  return `${prefix}-${__id}-${Math.random().toString(36).slice(2, 8)}`
}

export function createJob(
  marketIds: MarketId[],
  parentJobId: string | null = null,
): RegistrationJob {
  const id = nextId('job')
  const now = new Date().toISOString()
  const job: RegistrationJob = {
    id,
    parentJobId,
    status: 'pending',
    createdAt: now,
    startedAt: null,
    completedAt: null,
    statusHistory: [{ at: now, status: 'pending' }],
    marketResults: marketIds.map((m) => ({
      id: nextId('jmr'),
      jobId: id,
      marketId: m,
      marketStatus: 'pending',
      externalProductId: null,
      productUrl: null,
      errorCode: null,
      errorMessage: null,
      attemptCount: 0,
      excluded: false,
      lastAttemptedAt: null,
    })),
  }
  return job
}

// ─────────────────────────────────────────────
// error map — production lib/error-map.ts 와 1:1 매핑
// ─────────────────────────────────────────────

export function mapMarketErrorToJmrCode(
  code: MarketError['code'],
  oauthRefreshFailed: boolean,
): JmrErrorCode {
  switch (code) {
    case 'unauthorized':
      return oauthRefreshFailed ? 'oauth_revoked' : 'oauth_expired'
    case 'rate_limit':
      return 'rate_limit'
    case 'validation':
      return 'validation'
    case 'network':
      return 'timeout'
    case 'server':
      return 'market_5xx'
    case 'unknown':
    default:
      return 'unknown'
  }
}

export function isFinalErrorCode(code: JmrErrorCode): boolean {
  return (
    code === 'oauth_revoked' ||
    code === 'validation' ||
    code === 'image_invalid' ||
    code === 'duplicate' ||
    code === 'quota_exceeded' ||
    code === 'unknown'
  )
}

/**
 * production retry.ts §5 의 `MarketError.retryable` 와 동등.
 * - 재시도 가능: rate_limit / server / network.
 * - 재시도 불가: unauthorized / validation / unknown.
 *
 * 본 함수는 jmr.error_code 가 아닌 원시 MarketError.code 기준이라는 점에 주의.
 * (jmr.error_code 의 oauth_expired 는 production 에서 process.ts 가 1회 refresh 시도하는 분기와 매핑되지만,
 * worker 외부에서 본 retryable 만으로 결정.)
 */
export function isRetryableMarketCode(code: MarketError['code']): boolean {
  return code === 'rate_limit' || code === 'server' || code === 'network'
}

// ─────────────────────────────────────────────
// recomputeJobStatus — production jmr-update.ts 와 동등 로직
// (decideTerminalStatus + pending → running 전이)
// ─────────────────────────────────────────────

function recomputeJobStatus(job: RegistrationJob): void {
  const active = job.marketResults.filter((r) => !r.excluded)
  if (active.length === 0) return

  const hasNonFinal = active.some(
    (r) =>
      r.marketStatus === 'pending' ||
      r.marketStatus === 'in_flight' ||
      r.marketStatus === 'failed',
  )
  if (hasNonFinal) {
    // pending → running 전이 (1회만).
    if (job.status === 'pending') {
      const now = new Date().toISOString()
      job.status = 'running'
      job.startedAt = now
      job.statusHistory.push({ at: now, status: 'running' })
    }
    return
  }

  const successCount = active.filter(
    (r) => r.marketStatus === 'success',
  ).length
  const failedFinalCount = active.filter(
    (r) => r.marketStatus === 'failed_final',
  ).length

  let next: JobStatus
  if (successCount === active.length) next = 'succeeded'
  else if (failedFinalCount === active.length) next = 'failed'
  else next = 'partial'

  // running/retrying/pending 만 종결 가능 (terminal 재진입 금지).
  if (
    job.status === 'running' ||
    job.status === 'retrying' ||
    job.status === 'pending'
  ) {
    const now = new Date().toISOString()
    job.status = next
    job.completedAt = now
    job.statusHistory.push({ at: now, status: next })
  }
}

// ─────────────────────────────────────────────
// fan-out 오케스트레이터 — registration-market-worker 의 in-memory 등가물
// ─────────────────────────────────────────────

export interface FanOutOptions {
  /** 마켓당 maxAttempts. production DEFAULT_RETRY.maxAttempts = 5 와 별도 — 본 테스트는 attempt_count 3 한도(state.md §6.2). */
  maxAttempts?: number
  /** failure_final 컷오프 — production 과 동일하게 3. */
  attemptHardLimit?: number
}

/**
 * 1마켓 worker 의 in-memory 등가물.
 * 무한 루프 회피: maxAttempts 도달 또는 isFinalErrorCode → failed_final 적재.
 */
async function runMarketWorker(
  job: RegistrationJob,
  jmr: JobMarketResult,
  adapter: ScenarioAdapter,
  product: Product,
  mapping: MarketMapping,
  opts: Required<FanOutOptions>,
): Promise<void> {
  // 1) markJmrInFlight + recomputeJobStatus — 첫 attempt 시 pending → running 전이.
  jmr.marketStatus = 'in_flight'
  jmr.attemptCount += 1
  jmr.lastAttemptedAt = new Date().toISOString()
  recomputeJobStatus(job)

  // 2) withRetry — 재시도 가능 코드만 재시도. 한도 도달 시 throw.
  const payload = adapter.transformProduct(product, mapping)
  let lastErr: MarketError | null = null
  while (jmr.attemptCount <= opts.attemptHardLimit) {
    try {
      const result = await adapter.createProduct(payload)
      // 3) handleSuccess
      jmr.marketStatus = 'success'
      jmr.externalProductId = result.externalId
      jmr.productUrl = result.productUrl
      jmr.errorCode = null
      jmr.errorMessage = null
      jmr.lastAttemptedAt = new Date().toISOString()
      recomputeJobStatus(job)
      return
    } catch (err) {
      if (!(err instanceof MarketError)) throw err
      lastErr = err
      const code = mapMarketErrorToJmrCode(err.code, false)
      // production retry.ts: MarketError.retryable=false 면 즉시 throw → handleFailure.
      // isFinalErrorCode 는 jmr 적재 시 final 여부 결정. attempt 한도도 동일하게 final.
      const retryable = isRetryableMarketCode(err.code)
      const final =
        !retryable ||
        isFinalErrorCode(code) ||
        jmr.attemptCount >= opts.attemptHardLimit
      if (final) {
        // 4) handleFailure(final) — production handleFailure 가 결정.
        jmr.marketStatus = 'failed_final'
        jmr.errorCode = code
        jmr.errorMessage = err.message.slice(0, 200)
        jmr.lastAttemptedAt = new Date().toISOString()
        recomputeJobStatus(job)
        return
      }
      // 재시도 가능 → 다음 attempt
      jmr.marketStatus = 'failed'
      jmr.errorCode = code
      jmr.errorMessage = err.message.slice(0, 200)
      jmr.attemptCount += 1
      jmr.lastAttemptedAt = new Date().toISOString()
      recomputeJobStatus(job)
      // backoff 은 0ms (테스트 속도). production 은 1s base.
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  // 안전망 — 도달 불가.
  if (lastErr) {
    jmr.marketStatus = 'failed_final'
    jmr.errorCode = mapMarketErrorToJmrCode(lastErr.code, false)
    jmr.errorMessage = lastErr.message.slice(0, 200)
    recomputeJobStatus(job)
  }
}

/**
 * 4마켓 fan-out 실행. registration-start 가 마켓당 worker 를 invoke 하는 것과 동등.
 * Promise.all 로 병렬 실행.
 */
export async function runFanOut(
  job: RegistrationJob,
  adapters: Map<MarketId, ScenarioAdapter>,
  product: Product,
  mappingFor: (m: MarketId) => MarketMapping,
  options: FanOutOptions = {},
): Promise<RegistrationJob> {
  const opts: Required<FanOutOptions> = {
    maxAttempts: options.maxAttempts ?? 3,
    attemptHardLimit: options.attemptHardLimit ?? 3,
  }
  await Promise.all(
    job.marketResults
      .filter((r) => !r.excluded)
      .map((jmr) => {
        const adapter = adapters.get(jmr.marketId)
        if (!adapter) {
          throw new Error(`no adapter for ${jmr.marketId}`)
        }
        return runMarketWorker(
          job,
          jmr,
          adapter,
          product,
          mappingFor(jmr.marketId),
          opts,
        )
      }),
  )
  return job
}

// ─────────────────────────────────────────────
// "마켓 제외 후 재등록" 흐름 — n25 (history.md §)
// 부모 잡에서 failed_final 된 마켓만 자식 잡으로 다시 시도.
// ─────────────────────────────────────────────

export function createChildJobForRetry(
  parent: RegistrationJob,
  excludeMarkets: MarketId[],
): RegistrationJob {
  const remaining = parent.marketResults
    .filter((r) => !excludeMarkets.includes(r.marketId))
    .map((r) => r.marketId)
  if (remaining.length === 0) {
    throw new Error('cannot create child job: all markets excluded')
  }
  return createJob(remaining, parent.id)
}

// ─────────────────────────────────────────────
// 표준 fixture
// ─────────────────────────────────────────────

export const TEST_PRODUCT: Product = {
  id: '11111111-1111-1111-1111-111111111111',
  sellerId: '22222222-2222-2222-2222-222222222222',
  name: 'C-4 통합테스트 상품',
  priceKrw: 19_900,
  stock: 50,
  images: [{ url: 'https://cdn.example.com/p.jpg', order: 0 }],
  descriptionHtml: '',
  shippingFeeKrw: 0,
}

export function mappingFor(market: MarketId): MarketMapping {
  return {
    market,
    categoryId: 'C-100-10',
    transformedImageUrls: [
      `https://cdn.example.com/${market}/p-transformed.jpg`,
    ],
    extra: {},
  }
}

export const FOUR_MARKETS: readonly MarketId[] = [
  'naver',
  'coupang',
  'gmarket',
  'auction',
] as const
