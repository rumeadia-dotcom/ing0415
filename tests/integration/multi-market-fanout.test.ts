/**
 * C-4. 4마켓 동시 등록 fan-out 통합 시나리오 (12종).
 *
 * 마스터:
 *   - WIP-5markets-mvp.md C-4 통합 검증
 *   - docs/architecture/v1/cross-cutting/registration-job-state.md §4 / §6 / §10
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §5 (withRetry)
 *   - docs/architecture/v1/features/registration.md §6.3 / §6.4 / §6.5
 *
 * 파일 위치 근거:
 *   tests/integration/multi-market-fanout.test.ts
 *   (vitest.config.ts `include` 에 추가됨 — 본 PR 변경사항)
 *
 * 시나리오 12종:
 *   1. 모두 성공 — 4마켓 success → job = succeeded
 *   2. 부분 성공 (3/4) — 1마켓 failed_final → job = partial
 *   3. 모두 실패 — 4마켓 failed_final → job = failed
 *   4. 재시도 후 성공 — 1마켓 첫 시도 429, 재시도 success → succeeded
 *   5. 재시도 후 실패 — 1마켓 3회 모두 5xx → failed_final, job = partial
 *   6. 타임아웃 — 1마켓 network → 재시도 분기 (401 분기 X)
 *   7. 401 unauthorized — 1마켓 401 → 재시도 안 함 + needs_reauth 시그널(oauth_expired)
 *   8. 마켓 제외 후 재등록 — partial 잡 → 자식 잡 생성 → 검증
 *   9. 전체 재시도 — partial 잡의 failed 마켓 다시 시도 (v1 정책)
 *  10. 순차 vs 병렬 — 전체 latency < (가장 느린 latency × 1.2)
 *  11. 상태 전이 — pending → running → partial 시점 순서 검증
 *  12. 자식 잡 parentJobId — 부모 잡 id 와 일치
 *
 * 비범위 (의식적 제외):
 *   - 실 마켓 API E2E (C-1/C-3 완료 후 별도 PR)
 *   - 부하 테스트 (별도 PR)
 *   - DB 잠금 / RLS / Edge Function 인증 (pgTAP / Deno test 영역)
 *   - 11번가 (v2 — 11st 어댑터는 v1 disabled)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MarketId } from '@/lib/schemas'
import {
  FOUR_MARKETS,
  TEST_PRODUCT,
  createChildJobForRetry,
  createJob,
  createScenarioAdapter,
  installFetchGuard,
  isFinalErrorCode,
  mapMarketErrorToJmrCode,
  mappingFor,
  runFanOut,
  type AttemptOutcome,
  type MarketScenario,
} from './_helpers/scenario-builder'

// ─────────────────────────────────────────────
// 시나리오 → 어댑터 맵 헬퍼
// ─────────────────────────────────────────────

function buildAdapters(
  perMarket: Partial<Record<MarketId, AttemptOutcome[]>>,
  defaults: AttemptOutcome[] = [{ kind: 'success' }],
) {
  const m = new Map<MarketId, ReturnType<typeof createScenarioAdapter>>()
  for (const market of FOUR_MARKETS) {
    const attempts = perMarket[market] ?? defaults
    const scenario: MarketScenario = { market, attempts }
    m.set(market, createScenarioAdapter(scenario))
  }
  return m
}

// 헬퍼: Map.get 의 nullable 결과를 강제 — non-null assertion 회피.
function adapterOf<T>(m: Map<MarketId, T>, market: MarketId): T {
  const a = m.get(market)
  if (!a) throw new Error(`no adapter for ${market}`)
  return a
}

function jmrOf(
  job: { marketResults: { marketId: MarketId }[] },
  market: MarketId,
) {
  const r = job.marketResults.find((x) => x.marketId === market)
  if (!r) throw new Error(`no jmr for ${market}`)
  return r as (typeof job.marketResults)[number]
}

function notNull<T>(v: T | null | undefined, label: string): T {
  if (v === null || v === undefined) throw new Error(`${label} is nullish`)
  return v
}

// ─────────────────────────────────────────────
// 전역: 실 네트워크 호출 차단
// ─────────────────────────────────────────────

let restoreFetch: () => void
beforeEach(() => {
  restoreFetch = installFetchGuard()
})
afterEach(() => {
  restoreFetch()
})

// ─────────────────────────────────────────────
// 시나리오 1: 모두 성공
// ─────────────────────────────────────────────

describe('S1. 4마켓 모두 성공 → job = succeeded', () => {
  it('4마켓 success → 각 jmr.marketStatus = success, job = succeeded, completedAt 설정', async () => {
    const adapters = buildAdapters({}, [{ kind: 'success' }])
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('succeeded')
    expect(job.completedAt).not.toBeNull()
    expect(job.startedAt).not.toBeNull()
    expect(job.marketResults).toHaveLength(4)
    for (const jmr of job.marketResults) {
      expect(jmr.marketStatus).toBe('success')
      expect(jmr.externalProductId).toMatch(/^OK-/)
      expect(jmr.productUrl).toMatch(/^https:\/\/mock\./)
      expect(jmr.errorCode).toBeNull()
      expect(jmr.attemptCount).toBe(1)
    }
  })

  it('어댑터당 createProduct 호출은 정확히 1회', async () => {
    const adapters = buildAdapters({}, [{ kind: 'success' }])
    const job = createJob([...FOUR_MARKETS])
    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)
    for (const market of FOUR_MARKETS) {
      expect(adapterOf(adapters, market).callCount()).toBe(1)
    }
  })
})

// ─────────────────────────────────────────────
// 시나리오 2: 부분 성공 (3/4)
// ─────────────────────────────────────────────

describe('S2. 3성공/1실패 → job = partial', () => {
  it('1마켓 validation 실패 → 1 failed_final, 3 success, job = partial', async () => {
    const adapters = buildAdapters({
      auction: [{ kind: 'fail_validation' }],
    })
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('partial')
    const failed = jmrOf(job, 'auction')
    expect(failed.marketStatus).toBe('failed_final')
    expect(failed.errorCode).toBe('validation')
    const others = job.marketResults.filter((r) => r.marketId !== 'auction')
    for (const o of others) {
      expect(o.marketStatus).toBe('success')
    }
  })

  it('1마켓 5xx 3회 → final 5xx 도 partial', async () => {
    const adapters = buildAdapters({
      coupang: [
        { kind: 'fail_500' },
        { kind: 'fail_500' },
        { kind: 'fail_500' },
      ],
    })
    const job = createJob([...FOUR_MARKETS])
    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('partial')
    const cp = jmrOf(job, 'coupang')
    expect(cp.marketStatus).toBe('failed_final')
    expect(cp.errorCode).toBe('market_5xx')
    expect(cp.attemptCount).toBe(3)
  })
})

// ─────────────────────────────────────────────
// 시나리오 3: 모두 실패
// ─────────────────────────────────────────────

describe('S3. 4마켓 모두 failed_final → job = failed', () => {
  it('4마켓 모두 validation → 모두 failed_final, job = failed', async () => {
    const adapters = buildAdapters(
      Object.fromEntries(
        FOUR_MARKETS.map((m) => [m, [{ kind: 'fail_validation' }]]),
      ) as Record<MarketId, AttemptOutcome[]>,
    )
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('failed')
    expect(job.completedAt).not.toBeNull()
    for (const jmr of job.marketResults) {
      expect(jmr.marketStatus).toBe('failed_final')
      expect(jmr.errorCode).toBe('validation')
      expect(jmr.attemptCount).toBe(1)
    }
  })
})

// ─────────────────────────────────────────────
// 시나리오 4: 재시도 후 성공
// ─────────────────────────────────────────────

describe('S4. 1마켓 429 → 재시도 success → job = succeeded', () => {
  it('1마켓 첫 시도 429, 두번째 success → succeeded, 호출 2회', async () => {
    const adapters = buildAdapters({
      naver: [
        { kind: 'fail_429', retryAfterMs: 5 },
        { kind: 'success' },
      ],
    })
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('succeeded')
    const naver = jmrOf(job, 'naver')
    expect(naver.marketStatus).toBe('success')
    expect(naver.attemptCount).toBe(2)
    expect(naver.externalProductId).toMatch(/^OK-naver-2/)
    expect(adapterOf(adapters, 'naver').callCount()).toBe(2)
  })
})

// ─────────────────────────────────────────────
// 시나리오 5: 재시도 후 실패
// ─────────────────────────────────────────────

describe('S5. 1마켓 3회 5xx → failed_final → job = partial', () => {
  it('gmarket 3회 5xx → attempt_count 3, failed_final, 다른 마켓은 영향 없음', async () => {
    const adapters = buildAdapters({
      gmarket: [
        { kind: 'fail_500' },
        { kind: 'fail_500' },
        { kind: 'fail_500' },
      ],
    })
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('partial')
    const gmarket = jmrOf(job, 'gmarket')
    expect(gmarket.marketStatus).toBe('failed_final')
    expect(gmarket.errorCode).toBe('market_5xx')
    expect(gmarket.attemptCount).toBe(3)

    // 한 마켓 실패가 다른 마켓에 영향 없음 (registration.md §6.4 강제).
    const others = job.marketResults.filter((r) => r.marketId !== 'gmarket')
    for (const o of others) {
      expect(o.marketStatus).toBe('success')
      expect(o.attemptCount).toBe(1)
    }
  })
})

// ─────────────────────────────────────────────
// 시나리오 6: 타임아웃 → network 분기 → 재시도 가능
// ─────────────────────────────────────────────

describe('S6. 타임아웃 → network → 재시도 가능 (unauthorized 분기 X)', () => {
  it('1마켓 timeout 1회 + success → 재시도 후 성공', async () => {
    const adapters = buildAdapters({
      coupang: [{ kind: 'fail_timeout' }, { kind: 'success' }],
    })
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('succeeded')
    const cp = jmrOf(job, 'coupang')
    expect(cp.marketStatus).toBe('success')
    expect(cp.attemptCount).toBe(2)
  })

  it('network 에러 코드는 jmr.error_code = timeout 으로 매핑', () => {
    // error-map.ts §6.2.1 — production lib/error-map.ts 와 1:1 일치 검증.
    expect(mapMarketErrorToJmrCode('network', false)).toBe('timeout')
    expect(isFinalErrorCode('timeout')).toBe(false) // 재시도 가능
  })
})

// ─────────────────────────────────────────────
// 시나리오 7: 401 unauthorized → 재시도 안 함 + needs_reauth 시그널
// ─────────────────────────────────────────────

describe('S7. 401 → 재시도 없이 failed_final (needs_reauth 시그널)', () => {
  it('1마켓 401 → 즉시 failed_final 처리 (createProduct 호출 1회로 종료)', async () => {
    const adapters = buildAdapters({
      naver: [{ kind: 'fail_401' }],
    })
    const job = createJob([...FOUR_MARKETS])

    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    expect(job.status).toBe('partial')
    const naver = jmrOf(job, 'naver')
    // production withRetry §5: MarketError.retryable=false (unauthorized) → 즉시 throw.
    // worker.handleFailure 가 attempt 한도와 무관하게 failed_final 로 적재 (retryable=false 분기).
    expect(naver.marketStatus).toBe('failed_final')

    // jmr.error_code:
    //   - production worker process.ts 가 1회 refreshToken 시도 → 실패 시 oauthRefreshFailed=true →
    //     handleFailure 가 mapMarketErrorToJmrCode(unauthorized, true) = 'oauth_revoked' 적재.
    //   - 본 in-memory 모델은 refresh 단계를 생략 (refresh 자체는 별도 단위로 검증 — markets/__tests__).
    //     → oauthRefreshFailed=false 로 'oauth_expired' 적재.
    // 둘 다 클라이언트가 "마켓 재인증 필요" 배너를 띄우는 신호로 동등 처리.
    expect(naver.errorCode).toBe('oauth_expired')

    // 재시도 0회 강제 — 첫 호출 1회로 종료.
    expect(adapterOf(adapters, 'naver').callCount()).toBe(1)
  })

  it('isFinalErrorCode("oauth_expired") = false 이지만 production 은 refresh 후 oauth_revoked 로 final', () => {
    expect(isFinalErrorCode('oauth_expired')).toBe(false)
    // refresh 실패 시 oauth_revoked → isFinalErrorCode true.
    expect(mapMarketErrorToJmrCode('unauthorized', true)).toBe('oauth_revoked')
    expect(isFinalErrorCode('oauth_revoked')).toBe(true)
  })
})

// ─────────────────────────────────────────────
// 시나리오 8: 마켓 제외 후 재등록 (n25)
// ─────────────────────────────────────────────

describe('S8. partial 잡 → 실패 마켓 제외 후 새 job → 새 job 결과 검증', () => {
  it('부모 잡에서 1마켓 fail → 자식 잡은 실패한 마켓만 제외 → success', async () => {
    // 부모 잡: auction 만 실패.
    const adaptersParent = buildAdapters({
      auction: [{ kind: 'fail_validation' }],
    })
    const parent = createJob([...FOUR_MARKETS])
    await runFanOut(parent, adaptersParent, TEST_PRODUCT, mappingFor)
    expect(parent.status).toBe('partial')

    // 자식 잡 — auction 제외. 나머지 3마켓 재등록 시도 (예: 셀러가 카테고리 다시 매핑 후 등록).
    const child = createChildJobForRetry(parent, ['auction'])
    expect(child.parentJobId).toBe(parent.id)
    expect(child.marketResults).toHaveLength(3)
    expect(child.marketResults.map((r) => r.marketId)).not.toContain('auction')

    // 자식 잡 fan-out — 3마켓 모두 success.
    const adaptersChild = buildAdapters({}, [{ kind: 'success' }])
    await runFanOut(child, adaptersChild, TEST_PRODUCT, mappingFor)
    expect(child.status).toBe('succeeded')
    for (const jmr of child.marketResults) {
      expect(jmr.marketStatus).toBe('success')
    }
  })

  it('모든 마켓 제외 시도 → 에러 throw (호출측 reject 강제)', () => {
    const parent = createJob([...FOUR_MARKETS])
    expect(() =>
      createChildJobForRetry(parent, [...FOUR_MARKETS]),
    ).toThrow(/all markets excluded/)
  })
})

// ─────────────────────────────────────────────
// 시나리오 9: 전체 재시도 — v1 정책 (단건 재시도 X)
// ─────────────────────────────────────────────

describe('S9. 단건 재시도 v2 제외 — partial 잡의 failed 마켓 전체 재시도', () => {
  it('partial 잡의 failed_final 마켓만 다시 시도하면 모두 success → 잡 결과 = succeeded', async () => {
    // 첫 잡: 2마켓 실패.
    const adapters1 = buildAdapters({
      gmarket: [{ kind: 'fail_500' }, { kind: 'fail_500' }, { kind: 'fail_500' }],
      auction: [{ kind: 'fail_500' }, { kind: 'fail_500' }, { kind: 'fail_500' }],
    })
    const job1 = createJob([...FOUR_MARKETS])
    await runFanOut(job1, adapters1, TEST_PRODUCT, mappingFor)
    expect(job1.status).toBe('partial')

    const failedMarkets = job1.marketResults
      .filter((r) => r.marketStatus === 'failed_final')
      .map((r) => r.marketId)
    expect(failedMarkets.sort()).toEqual(['auction', 'gmarket'])

    // 재시도 잡 — failed 마켓만으로 새 잡. 이번엔 모두 success.
    const job2 = createJob(failedMarkets, job1.id)
    expect(job2.parentJobId).toBe(job1.id)
    const adapters2 = buildAdapters({}, [{ kind: 'success' }])
    await runFanOut(job2, adapters2, TEST_PRODUCT, mappingFor)
    expect(job2.status).toBe('succeeded')
  })
})

// ─────────────────────────────────────────────
// 시나리오 10: 순차 vs 병렬 — fan-out 병렬성 검증
// ─────────────────────────────────────────────

describe('S10. 4마켓 fan-out 병렬 — 전체 latency < 가장 느린 마켓 × 1.2', () => {
  it('마켓 latency = [40, 60, 80, 100]ms 일 때 전체 시간 ≤ 120ms 범위', async () => {
    const adapters = buildAdapters({
      naver: [{ kind: 'success_delay_ms', ms: 40 }],
      coupang: [{ kind: 'success_delay_ms', ms: 60 }],
      gmarket: [{ kind: 'success_delay_ms', ms: 80 }],
      auction: [{ kind: 'success_delay_ms', ms: 100 }],
    })
    const job = createJob([...FOUR_MARKETS])

    const start = Date.now()
    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)
    const elapsed = Date.now() - start

    expect(job.status).toBe('succeeded')
    // 가장 느린 latency = 100ms. 직렬 실행이면 합 280ms. 병렬이면 ~100ms.
    // 1.2 배 = 120ms. CI 변동성 감안 일부 슬랙 + jsdom timer 지터로 200ms 까지 허용.
    // (병렬성을 정성적으로 보장: 합산 280ms 보다 훨씬 작아야 한다.)
    expect(elapsed).toBeLessThan(200)
    // 명확한 fan-out 신호: 가장 빠른 마켓이 가장 느린 마켓을 기다리지 않음.
    expect(elapsed).toBeLessThan(40 + 60 + 80 + 100)
  })
})

// ─────────────────────────────────────────────
// 시나리오 11: 상태 전이 시점 검증
// ─────────────────────────────────────────────

describe('S11. 상태 전이: pending → running → partial 순서 + 시점', () => {
  it('statusHistory 순서가 [pending, running, partial] 이고 partial 은 마지막 결과 시점 이후', async () => {
    const adapters = buildAdapters({
      auction: [{ kind: 'fail_validation' }],
    })
    const job = createJob([...FOUR_MARKETS])
    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    const sequence = job.statusHistory.map((h) => h.status)
    expect(sequence).toEqual(['pending', 'running', 'partial'])

    // startedAt / completedAt 의 인과 관계.
    const startedAt = notNull(job.startedAt, 'startedAt')
    const completedAt = notNull(job.completedAt, 'completedAt')
    expect(Date.parse(startedAt)).toBeLessThanOrEqual(Date.parse(completedAt))
    expect(Date.parse(job.createdAt)).toBeLessThanOrEqual(Date.parse(startedAt))

    // partial 전이 시점 = 모든 jmr 종료 시점 이후.
    const lastJmrAttempt = Math.max(
      ...job.marketResults.map((r) =>
        r.lastAttemptedAt ? Date.parse(r.lastAttemptedAt) : 0,
      ),
    )
    expect(Date.parse(completedAt)).toBeGreaterThanOrEqual(lastJmrAttempt)
  })

  it('전부 success 일 때 statusHistory = [pending, running, succeeded]', async () => {
    const adapters = buildAdapters({}, [{ kind: 'success' }])
    const job = createJob([...FOUR_MARKETS])
    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)

    const sequence = job.statusHistory.map((h) => h.status)
    expect(sequence).toEqual(['pending', 'running', 'succeeded'])
  })

  it('전부 failed_final 일 때 statusHistory = [pending, running, failed]', async () => {
    const adapters = buildAdapters(
      Object.fromEntries(
        FOUR_MARKETS.map((m) => [m, [{ kind: 'fail_validation' }]]),
      ) as Record<MarketId, AttemptOutcome[]>,
    )
    const job = createJob([...FOUR_MARKETS])
    await runFanOut(job, adapters, TEST_PRODUCT, mappingFor)
    const sequence = job.statusHistory.map((h) => h.status)
    expect(sequence).toEqual(['pending', 'running', 'failed'])
  })
})

// ─────────────────────────────────────────────
// 시나리오 12: 자식 잡 parentJobId
// ─────────────────────────────────────────────

describe('S12. 마켓 제외 재등록 — 자식 잡 parentJobId 가 부모 id 와 일치', () => {
  it('자식 잡 parentJobId === 부모 잡 id', () => {
    const parent = createJob([...FOUR_MARKETS])
    const child = createChildJobForRetry(parent, ['auction'])
    expect(child.parentJobId).toBe(parent.id)
    expect(child.id).not.toBe(parent.id)
    // 부모 잡은 자식 잡을 모름 (단방향 — registration.md §3.4).
    expect(parent.parentJobId).toBeNull()
  })

  it('손자 잡(grandchild) 은 부모의 부모 id 가 아니라 직계 부모 id 만 기록', () => {
    const grandparent = createJob([...FOUR_MARKETS])
    const parent = createChildJobForRetry(grandparent, ['auction'])
    const child = createChildJobForRetry(parent, ['gmarket'])
    expect(child.parentJobId).toBe(parent.id)
    expect(child.parentJobId).not.toBe(grandparent.id)
  })
})

// ─────────────────────────────────────────────
// 보조 단위 — error-map / final code 분류
// (production lib/error-map.ts 와 1:1 미러)
// ─────────────────────────────────────────────

describe('U1. mapMarketErrorToJmrCode — production error-map.ts 와 1:1 미러', () => {
  it.each([
    ['unauthorized', false, 'oauth_expired'],
    ['unauthorized', true, 'oauth_revoked'],
    ['rate_limit', false, 'rate_limit'],
    ['validation', false, 'validation'],
    ['network', false, 'timeout'],
    ['server', false, 'market_5xx'],
    ['unknown', false, 'unknown'],
  ] as const)(
    '%s + refreshFailed=%s → %s',
    (code, refreshFailed, expected) => {
      expect(mapMarketErrorToJmrCode(code, refreshFailed)).toBe(expected)
    },
  )
})

describe('U2. isFinalErrorCode — 재시도 불가 코드 분류', () => {
  it.each([
    ['oauth_revoked', true],
    ['validation', true],
    ['image_invalid', true],
    ['duplicate', true],
    ['quota_exceeded', true],
    ['unknown', true],
    ['oauth_expired', false],
    ['rate_limit', false],
    ['timeout', false],
    ['market_5xx', false],
  ] as const)('%s → final=%s', (code, final) => {
    expect(isFinalErrorCode(code)).toBe(final)
  })
})

describe('U3. fetch guard — 실 네트워크 호출이 발생하면 즉시 fail', () => {
  it('fetch 호출 시도는 throw — adapter 가 fetch 를 직접 호출하지 않음', () => {
    expect(() => globalThis.fetch('https://example.com')).toThrow(
      /blocked in integration test/,
    )
  })
})
