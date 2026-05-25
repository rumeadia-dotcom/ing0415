import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context/AuthContext'

/**
 * AuthContext redirect URL 회귀 테스트.
 *
 * 마스터:
 *  - apps/web/src/lib/url.ts buildAppUrl
 *  - PR #154 / hotfix v0.11.1 — 신규 회원가입 + 비밀번호 재설정 이메일 인증 후
 *    GitHub Pages 404 사고 (원인: `${origin}/login` 이 운영 subpath `/ing0415/`
 *    누락).
 *
 * 본 테스트는 AuthContext 가 Supabase auth 메서드에 전달하는 redirect URL 이
 * 항상 buildAppUrl 로 빌드되어 운영 subpath 를 포함하도록 회귀 잠금.
 *
 * vitest 환경의 `import.meta.env.BASE_URL` 은 디폴트로 '/' — 본 테스트는
 * `vi.stubEnv` 로 운영 baseUrl '/ing0415/' 를 강제해 회귀 시 즉시 fail 보장.
 */

type AuthChangeHandler = (event: string, next: unknown) => void

const signUpSpy = vi.fn()
const resetPasswordSpy = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: (_cb: AuthChangeHandler) => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: signUpSpy,
      resetPasswordForEmail: resetPasswordSpy,
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}))

function CaptureFns({
  onReady,
}: {
  onReady: (signUp: ReturnType<typeof useAuth>['signUp'], reset: ReturnType<typeof useAuth>['sendPasswordResetEmail']) => void
}): JSX.Element {
  const { signUp, sendPasswordResetEmail } = useAuth()
  onReady(signUp, sendPasswordResetEmail)
  return <div />
}

beforeEach(() => {
  signUpSpy.mockReset().mockResolvedValue({ error: null })
  resetPasswordSpy.mockReset().mockResolvedValue({ error: null })
  // window.location.origin 가 jsdom 디폴트 'http://localhost' — 명시 stub 으로
  // 운영 시나리오 origin 강제.
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://rumeadia-dotcom.github.io' },
    writable: true,
  })
})

describe('AuthContext redirect URL — Vite BASE_URL 정합 회귀 가드 (PR #154)', () => {
  it('운영 (BASE_URL="/ing0415/") signUp → emailRedirectTo = /ing0415/login', async () => {
    vi.stubEnv('BASE_URL', '/ing0415/')

    let signUpFn: ReturnType<typeof useAuth>['signUp'] | null = null
    render(
      <AuthProvider>
        <CaptureFns
          onReady={(s) => {
            signUpFn = s
          }}
        />
      </AuthProvider>,
    )
    await act(async () => {
      await (signUpFn as NonNullable<typeof signUpFn>)({
        email: 'a@b.test',
        password: 'pw123456!',
        displayName: 'Test',
        marketingConsent: false,
      })
    })

    expect(signUpSpy).toHaveBeenCalledTimes(1)
    const callArg = signUpSpy.mock.calls[0]?.[0] as { options: { emailRedirectTo: string } }
    expect(callArg.options.emailRedirectTo).toBe(
      'https://rumeadia-dotcom.github.io/ing0415/login',
    )

    vi.unstubAllEnvs()
  })

  it('운영 (BASE_URL="/ing0415/") sendPasswordResetEmail → redirectTo = /ing0415/reset-password', async () => {
    vi.stubEnv('BASE_URL', '/ing0415/')

    let resetFn: ReturnType<typeof useAuth>['sendPasswordResetEmail'] | null = null
    render(
      <AuthProvider>
        <CaptureFns
          onReady={(_, r) => {
            resetFn = r
          }}
        />
      </AuthProvider>,
    )
    await act(async () => {
      await (resetFn as NonNullable<typeof resetFn>)('a@b.test')
    })

    expect(resetPasswordSpy).toHaveBeenCalledTimes(1)
    const call = resetPasswordSpy.mock.calls[0] as
      | [string, { redirectTo: string }]
      | undefined
    expect(call).toBeDefined()
    const [emailArg, optsArg] = call as [string, { redirectTo: string }]
    expect(emailArg).toBe('a@b.test')
    expect(optsArg.redirectTo).toBe(
      'https://rumeadia-dotcom.github.io/ing0415/reset-password',
    )

    vi.unstubAllEnvs()
  })

  it('dev / 로컬 (BASE_URL="/") signUp → emailRedirectTo = /login (subpath 없음)', async () => {
    vi.stubEnv('BASE_URL', '/')

    let signUpFn: ReturnType<typeof useAuth>['signUp'] | null = null
    render(
      <AuthProvider>
        <CaptureFns
          onReady={(s) => {
            signUpFn = s
          }}
        />
      </AuthProvider>,
    )
    await act(async () => {
      await (signUpFn as NonNullable<typeof signUpFn>)({
        email: 'a@b.test',
        password: 'pw123456!',
        displayName: 'Test',
        marketingConsent: false,
      })
    })

    const callArg = signUpSpy.mock.calls[0]?.[0] as { options: { emailRedirectTo: string } }
    expect(callArg.options.emailRedirectTo).toBe(
      'https://rumeadia-dotcom.github.io/login',
    )

    vi.unstubAllEnvs()
  })
})
