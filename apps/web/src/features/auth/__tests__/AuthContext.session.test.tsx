import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from '../context/AuthContext'

/**
 * AuthContext 세션 라이프사이클 통합 테스트.
 *
 * 검증 대상:
 *  - 초기 hydrate (storage 에서 session 복원)
 *  - onAuthStateChange 구독 — SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED 이벤트별 status 전이
 *  - refresh token rotation 시나리오 (TOKEN_REFRESHED → 세션 갱신, status 유지)
 *  - 세션 만료 (외부 signal) → SIGNED_OUT 이벤트로 anonymous 전환
 *
 * Supabase 클라이언트는 `getSupabase` 를 vi.mock 으로 갈음.
 */

type AuthChangeHandler = (event: string, next: Session | null) => void

let getSessionImpl: () => Promise<{
  data: { session: Session | null }
  error: null
}>
let authChangeHandler: AuthChangeHandler | null = null

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => getSessionImpl(),
      onAuthStateChange: (cb: AuthChangeHandler) => {
        authChangeHandler = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}))

function StatusProbe(): JSX.Element {
  const { status, user } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user-id">{user?.id ?? 'none'}</span>
    </div>
  )
}

function makeSession(id: string, expiresAtSec = 1_700_000_000): Session {
  return {
    access_token: 't-' + id,
    refresh_token: 'r-' + id,
    expires_in: 3600,
    expires_at: expiresAtSec,
    token_type: 'bearer',
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    } as Session['user'],
  }
}

beforeEach(() => {
  authChangeHandler = null
  getSessionImpl = () =>
    Promise.resolve({ data: { session: null }, error: null })
})

describe('AuthContext - session lifecycle', () => {
  it('초기 hydrate: storage 에 세션 없으면 anonymous', async () => {
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('loading')
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('anonymous')
    })
    expect(screen.getByTestId('user-id').textContent).toBe('none')
  })

  it('초기 hydrate: storage 에 세션 있으면 authed + user.id 노출', async () => {
    const s = makeSession('seller-a')
    getSessionImpl = () =>
      Promise.resolve({ data: { session: s }, error: null })
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authed')
    })
    expect(screen.getByTestId('user-id').textContent).toBe('seller-a')
  })

  it('TOKEN_REFRESHED 이벤트: session 갱신되고 status=authed 유지', async () => {
    const s1 = makeSession('seller-a')
    getSessionImpl = () =>
      Promise.resolve({ data: { session: s1 }, error: null })
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authed')
    })

    const s2 = makeSession('seller-a', 1_800_000_000) // 새 expires_at
    act(() => {
      authChangeHandler?.('TOKEN_REFRESHED', s2)
    })
    expect(screen.getByTestId('status').textContent).toBe('authed')
    expect(screen.getByTestId('user-id').textContent).toBe('seller-a')
  })

  it('SIGNED_OUT 이벤트 (세션 만료 시뮬레이션): authed → anonymous 전이', async () => {
    const s = makeSession('seller-a')
    getSessionImpl = () =>
      Promise.resolve({ data: { session: s }, error: null })
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authed')
    })

    // 세션 만료 = Supabase SDK 가 SIGNED_OUT 이벤트로 알림
    act(() => {
      authChangeHandler?.('SIGNED_OUT', null)
    })
    expect(screen.getByTestId('status').textContent).toBe('anonymous')
    expect(screen.getByTestId('user-id').textContent).toBe('none')
  })

  it('SIGNED_IN 이벤트: anonymous → authed 전이', async () => {
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('anonymous')
    })

    act(() => {
      authChangeHandler?.('SIGNED_IN', makeSession('seller-b'))
    })
    expect(screen.getByTestId('status').textContent).toBe('authed')
    expect(screen.getByTestId('user-id').textContent).toBe('seller-b')
  })
})
