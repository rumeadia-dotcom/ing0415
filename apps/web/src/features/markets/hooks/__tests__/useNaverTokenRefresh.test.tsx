/**
 * useNaverTokenRefresh 단위 테스트 (4건).
 *
 * 마스터: WIP-5markets-mvp.md C-1 Phase 4
 * 근거 — markets.md §5.4 / §5.5.
 *
 * 테스트 카테고리:
 *   H1. computeNextRefreshEpoch — 네이버 active 계정 + 정상 lastVerifiedAt
 *       → triggerAt = lastVerifiedMs + ttl - 5분
 *   H2. computeNextRefreshEpoch — 만료 임박 / 이미 지남 → 즉시 nowMs 반환
 *   H3. computeNextRefreshEpoch — 다른 마켓 / inactive / lastVerifiedAt 없음 → null
 *   H4. useNaverTokenRefresh hook — credentialId 변경 시 mutation trigger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

// AuthContext mock
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: '00000000-0000-0000-0000-000000000001' } }),
}))

// supabase mock — invoke 가짜
const invokeMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: invokeMock },
  }),
}))

import {
  computeNextRefreshEpoch,
  useNaverTokenRefresh,
} from '../useNaverTokenRefresh'

function makeAccount(overrides: Partial<MarketAccount> = {}): MarketAccount {
  return {
    id: '00000000-0000-0000-0000-000000000aaa',
    marketId: 'naver',
    accountLabel: '메인 스토어',
    externalAccountId: null,
    status: 'active',
    connectedAt: '2026-05-20T09:00:00.000+09:00',
    lastVerifiedAt: '2026-05-20T09:00:00.000+09:00',
    lastErrorCode: null,
    lastErrorAt: null,
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('H1: computeNextRefreshEpoch — 네이버 active 정상 케이스', () => {
  it('triggerAt = lastVerifiedMs + ttl - refreshBefore', () => {
    const account = makeAccount({
      lastVerifiedAt: '2026-05-20T00:00:00.000Z',
    })
    const lastVerifiedMs = Date.parse('2026-05-20T00:00:00.000Z')
    const nowMs = lastVerifiedMs + 60 * 1000 // 1분 후
    const ttlMs = 3 * 60 * 60 * 1000 // 3시간
    const refreshBeforeMs = 5 * 60 * 1000 // 5분

    const result = computeNextRefreshEpoch(account, {
      nowMs,
      assumedTtlMs: ttlMs,
      refreshBeforeMs,
    })
    expect(result).toBe(lastVerifiedMs + ttlMs - refreshBeforeMs)
  })
})

describe('H2: computeNextRefreshEpoch — 이미 지난 trigger → 즉시 now', () => {
  it('trigger 시각이 nowMs 보다 과거이면 nowMs 반환 (즉시 실행)', () => {
    const account = makeAccount({
      lastVerifiedAt: '2026-05-20T00:00:00.000Z',
    })
    const lastVerifiedMs = Date.parse('2026-05-20T00:00:00.000Z')
    const ttlMs = 3 * 60 * 60 * 1000
    const refreshBeforeMs = 5 * 60 * 1000
    // 이미 ttl - refreshBefore 시각을 1분 지난 시각
    const nowMs = lastVerifiedMs + ttlMs - refreshBeforeMs + 60 * 1000

    const result = computeNextRefreshEpoch(account, {
      nowMs,
      assumedTtlMs: ttlMs,
      refreshBeforeMs,
    })
    expect(result).toBe(nowMs)
  })
})

describe('H3: computeNextRefreshEpoch — null 케이스', () => {
  it('marketId !== "naver" → null', () => {
    const account = makeAccount({ marketId: 'coupang' })
    expect(
      computeNextRefreshEpoch(account, { nowMs: Date.now() }),
    ).toBeNull()
  })
  it('status !== "active" → null', () => {
    const account = makeAccount({ status: 'revoked' })
    expect(
      computeNextRefreshEpoch(account, { nowMs: Date.now() }),
    ).toBeNull()
  })
  it('lastVerifiedAt 없음 → null', () => {
    const account = makeAccount({ lastVerifiedAt: null })
    expect(
      computeNextRefreshEpoch(account, { nowMs: Date.now() }),
    ).toBeNull()
  })
})

describe('H4: useNaverTokenRefresh — triggerRefresh 호출 시 mutation invoke', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  it('credentialId 보유 + triggerRefresh → markets-token-refresh invoke', async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        refreshedCount: 1,
        failedCount: 0,
        skippedCount: 0,
        correlationId: 'cid-1',
      },
      error: null,
    })

    const account = makeAccount()
    const credentialId = '00000000-0000-0000-0000-000000000ccc'

    const { result } = renderHook(
      () => useNaverTokenRefresh(account, { credentialId }),
      { wrapper },
    )

    act(() => {
      result.current.triggerRefresh()
    })

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('markets-token-refresh', {
        body: { mode: 'on_demand', credentialId },
      })
    })
  })
})
