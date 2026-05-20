/**
 * Sentry beforeSend / beforeBreadcrumb 통합 단위 테스트.
 *
 * 출처 / 근거:
 *   - 작업 카드: D-D (WIP-5markets-mvp.md Phase 4)
 *   - 마스터: docs/architecture/v1/security.md §6.3 (Sentry 초기화 시 마스킹 강제)
 *   - CLAUDE.md "외부 API 로깅 패턴" — Sentry 송출 전 마스킹 의무
 *
 * 목적:
 *   `initSentry()` 호출 시 `Sentry.init` 으로 전달되는 옵션에 `beforeSend` /
 *   `beforeBreadcrumb` 가 등록되고, 그 hook 들이 `redact()` 마스킹을 통과시키는지
 *   회귀로 잠근다 (소스 코드 정리 / 옵션 누락 PR 차단).
 *
 * 시나리오:
 *   S1. initSentry() → Sentry.init 호출 + beforeSend / beforeBreadcrumb 등록
 *   S2. beforeSend(event) → request / extra / contexts / tags / breadcrumbs 마스킹
 *   S3. beforeBreadcrumb(crumb) → crumb.data 마스킹
 *   S4. DSN 없음 → Sentry.init 호출 안 됨 (no-op)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent, Breadcrumb } from '@sentry/react'

// ─── @sentry/react 모킹 — init 으로 전달된 옵션 캡처 ─────────────────────────────
const initSpy = vi.fn()

vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initSpy(...args),
  browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
}))

// ─── env 모킹 — DSN 토글용 ─────────────────────────────
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

describe('initSentry() — beforeSend / beforeBreadcrumb 마스킹 통합 (D-D Phase 4)', () => {
  beforeEach(() => {
    initSpy.mockClear()
    vi.resetModules()
    envState.VITE_SENTRY_DSN = 'https://public@sentry.test/1'
    envState.VITE_APP_MODE = 'debug'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ─── S1 ─────────────────────────────
  it('S1: initSentry() → Sentry.init 호출 + beforeSend/beforeBreadcrumb 등록', async () => {
    const { initSentry } = await import('../sentry')
    initSentry()
    expect(initSpy).toHaveBeenCalledTimes(1)
    const opts = initSpy.mock.calls[0]?.[0] as { beforeSend: unknown; beforeBreadcrumb: unknown }
    expect(typeof opts.beforeSend).toBe('function')
    expect(typeof opts.beforeBreadcrumb).toBe('function')
  })

  // ─── S2 ─────────────────────────────
  it('S2: beforeSend(event) → request/extra/contexts/tags/breadcrumbs 전부 마스킹', async () => {
    const { initSentry } = await import('../sentry')
    initSentry()
    const opts = initSpy.mock.calls[0]?.[0] as {
      beforeSend: (e: ErrorEvent) => ErrorEvent | null
    }

    const event: ErrorEvent = {
      type: undefined,
      request: {
        // url 은 string 이라 키 기반 마스킹 대상이 아니다 (URL query 의 PII 는
        // 호출측이 구조화해서 data/headers 로 넣어야 한다 — security.md §6.3 명시).
        // 여기서는 headers / data 의 키 기반 마스킹만 검증.
        url: 'https://app.test/callback',
        headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig' },
        data: { access_token: 'rt_xxx' },
      },
      extra: {
        accessKey: 'AK_RAW_LEAK',
        secretKey: 'SK_RAW_LEAK',
        vendorId: 'A00001234',
      },
      contexts: {
        market: { masterId: 'gmarket_master_001', sellerId: 'uuid-preserved' },
      },
      tags: { email: 'seller@example.com' },
      breadcrumbs: [
        {
          message: 'oauth callback',
          data: { code: 'oauth_code_abc', state: 'csrf_xyz' },
        },
      ],
    }

    const out = opts.beforeSend(event)
    expect(out).not.toBeNull()
    const json = JSON.stringify(out)

    // 금지 값 누출 0건
    const forbidden = [
      'oauth_code_abc',
      'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      'rt_xxx',
      'AK_RAW_LEAK',
      'SK_RAW_LEAK',
      'A00001234',
      'gmarket_master_001',
      'seller@example.com',
      'csrf_xyz',
    ]
    for (const v of forbidden) {
      expect(json).not.toContain(v)
    }

    // internal sellerId 는 보존
    expect(json).toContain('uuid-preserved')
  })

  // ─── S3 ─────────────────────────────
  it('S3: beforeBreadcrumb(crumb) → crumb.data 마스킹', async () => {
    const { initSentry } = await import('../sentry')
    initSentry()
    const opts = initSpy.mock.calls[0]?.[0] as {
      beforeBreadcrumb: (c: Breadcrumb) => Breadcrumb | null
    }

    const crumb: Breadcrumb = {
      message: 'market call',
      category: 'fetch',
      data: {
        url: 'https://api.coupang.test/v2/products',
        accessKey: 'AK_CRUMB_LEAK',
        secretKey: 'SK_CRUMB_LEAK',
      },
    }
    const out = opts.beforeBreadcrumb(crumb)
    expect(out).not.toBeNull()
    const json = JSON.stringify(out)
    expect(json).not.toContain('AK_CRUMB_LEAK')
    expect(json).not.toContain('SK_CRUMB_LEAK')
  })

  // ─── S4 ─────────────────────────────
  it('S4: DSN 없음 → Sentry.init 호출 안 됨 (no-op)', async () => {
    envState.VITE_SENTRY_DSN = undefined
    const { initSentry } = await import('../sentry')
    initSentry()
    expect(initSpy).not.toHaveBeenCalled()
  })

  // ─── 부가: 중복 호출 멱등 ─────────────────────────────
  it('initSentry() 두 번 호출 → 한 번만 init', async () => {
    const { initSentry } = await import('../sentry')
    initSentry()
    initSentry()
    expect(initSpy).toHaveBeenCalledTimes(1)
  })
})
