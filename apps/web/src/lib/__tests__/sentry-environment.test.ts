/**
 * Sentry environment 분리 회귀 테스트 — debug ↔ real 데이터 혼입 차단.
 *
 * 출처 / 근거:
 *   - 작업 카드: D-D (WIP-5markets-mvp.md Phase 4)
 *   - 마스터: docs/architecture/v1/security.md §6.3 (environment = 빌드 모드 그대로)
 *             CLAUDE.md "빌드 모드: debug / real" — 두 환경 데이터 절대 혼입 금지
 *
 * 목적:
 *   `initSentry()` 가 `Sentry.init({ environment })` 에 `'debug'` 또는 `'real'`
 *   문자열을 전달하는지, 그리고 `tracesSampleRate` 가 모드별로 분리되는지 회귀.
 *
 * 시나리오:
 *   M1. debug 모드 → environment='debug', tracesSampleRate=1.0
 *   M2. real 모드  → environment='real',  tracesSampleRate=0.1
 *   M3. 두 모드 호출이 같은 process 에서도 상호 오염되지 않음 (test 격리)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const initSpy = vi.fn()

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initSpy(...args),
  browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
}))

const envState = {
  VITE_SENTRY_DSN: 'https://public@sentry.test/1' as string | undefined,
  VITE_APP_MODE: 'debug' as 'debug' | 'real',
}

vi.mock('../env', () => ({
  get env() {
    return {
      VITE_SENTRY_DSN: envState.VITE_SENTRY_DSN,
      VITE_APP_MODE: envState.VITE_APP_MODE,
    }
  },
  get isDebug() {
    return envState.VITE_APP_MODE === 'debug'
  },
  get isReal() {
    return envState.VITE_APP_MODE === 'real'
  },
}))

interface SentryInitOpts {
  environment: string
  tracesSampleRate: number
  dsn: string
}

describe('initSentry() — environment 분리 (D-D Phase 4)', () => {
  beforeEach(() => {
    initSpy.mockClear()
    vi.resetModules()
    envState.VITE_SENTRY_DSN = 'https://public@sentry.test/1'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── M1 ─────────────────────────────
  it("M1: debug 모드 → environment='debug', tracesSampleRate=1.0", async () => {
    envState.VITE_APP_MODE = 'debug'
    const { initSentry } = await import('../sentry')
    initSentry()
    expect(initSpy).toHaveBeenCalledTimes(1)
    const opts = initSpy.mock.calls[0]?.[0] as SentryInitOpts
    expect(opts.environment).toBe('debug')
    expect(opts.tracesSampleRate).toBe(1.0)
  })

  // ─── M2 ─────────────────────────────
  it("M2: real 모드 → environment='real', tracesSampleRate=0.1", async () => {
    envState.VITE_APP_MODE = 'real'
    const { initSentry } = await import('../sentry')
    initSentry()
    expect(initSpy).toHaveBeenCalledTimes(1)
    const opts = initSpy.mock.calls[0]?.[0] as SentryInitOpts
    expect(opts.environment).toBe('real')
    expect(opts.tracesSampleRate).toBe(0.1)
  })

  // ─── M3 ─────────────────────────────
  it("M3: 모듈 reset 사이 환경 분리 — 한쪽 모드 호출이 다른쪽 환경값을 오염시키지 않음", async () => {
    envState.VITE_APP_MODE = 'debug'
    let m = await import('../sentry')
    m.initSentry()
    const debugEnv = (initSpy.mock.calls[0]?.[0] as SentryInitOpts).environment
    expect(debugEnv).toBe('debug')

    vi.resetModules()
    initSpy.mockClear()
    envState.VITE_APP_MODE = 'real'
    m = await import('../sentry')
    m.initSentry()
    const realEnv = (initSpy.mock.calls[0]?.[0] as SentryInitOpts).environment
    expect(realEnv).toBe('real')
  })

  // ─── 부가: DSN 누락이면 두 모드 모두 no-op ─────────────────────────────
  it('M4: DSN 누락 → debug / real 어느 쪽이든 init 호출 안 됨', async () => {
    envState.VITE_SENTRY_DSN = undefined
    envState.VITE_APP_MODE = 'debug'
    let m = await import('../sentry')
    m.initSentry()
    expect(initSpy).not.toHaveBeenCalled()

    vi.resetModules()
    envState.VITE_APP_MODE = 'real'
    m = await import('../sentry')
    m.initSentry()
    expect(initSpy).not.toHaveBeenCalled()
  })
})
