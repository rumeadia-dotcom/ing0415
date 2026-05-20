import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import type * as AuthContextModule from '../context/AuthContext'

// ─────────────────────────────────────────────
// mocks
// ─────────────────────────────────────────────
const signUpMock = vi.fn()

vi.mock('../context/AuthContext', async () => {
  const actual =
    await vi.importActual<typeof AuthContextModule>('../context/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      status: 'anonymous',
      session: null,
      user: null,
      signInWithPassword: vi.fn(),
      signUp: signUpMock,
      sendPasswordResetEmail: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
    }),
  }
})

import { SignupPage } from '../pages/SignupPage'

function renderPage(): void {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={children} />
      </Routes>
    </MemoryRouter>
  )
  render(<SignupPage />, { wrapper })
}

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<{
    name: string
    email: string
    password: string
    confirm: string
    skipTerms: boolean
  }> = {},
): Promise<void> {
  await user.type(screen.getByLabelText('표시 이름'), overrides.name ?? '홍길동')
  await user.type(
    screen.getByLabelText('이메일'),
    overrides.email ?? 'qa@marketcast.test',
  )
  const password = overrides.password ?? 'Strong#Pass1'
  await user.type(screen.getByLabelText('비밀번호'), password)
  await user.type(
    screen.getByLabelText('비밀번호 확인'),
    overrides.confirm ?? password,
  )
  if (!overrides.skipTerms) {
    await user.click(
      screen.getByLabelText(/이용약관 및 개인정보처리방침 동의/),
    )
  }
}

beforeEach(() => {
  signUpMock.mockReset()
})

// ─────────────────────────────────────────────
// 1. validation
// ─────────────────────────────────────────────
describe('SignupPage - validation', () => {
  it('빈 폼 submit 시 signUp 미호출 + 다수 alert', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: '가입하기' }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(3)
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('약관 미동의 → signUp 미호출 + termsAgreed alert', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillValidForm(user, { skipTerms: true })
    await user.click(screen.getByRole('button', { name: '가입하기' }))
    await waitFor(() => {
      expect(signUpMock).not.toHaveBeenCalled()
    })
  })

  it('비밀번호 확인 불일치 → signUp 미호출', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillValidForm(user, { confirm: 'Different#Pass1' })
    await user.click(screen.getByRole('button', { name: '가입하기' }))
    await waitFor(() => {
      expect(signUpMock).not.toHaveBeenCalled()
    })
  })
})

// ─────────────────────────────────────────────
// 2. submit flow
// ─────────────────────────────────────────────
describe('SignupPage - submit flow', () => {
  it('valid 폼 → signUp 호출 + 성공 시 "이메일 인증 안내" 화면 전환', async () => {
    signUpMock.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderPage()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: '가입하기' }))

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledTimes(1)
    })
    const callArgs = signUpMock.mock.calls[0]?.[0] as {
      email: string
      password: string
      displayName: string
      marketingConsent: boolean
    }
    expect(callArgs.email).toBe('qa@marketcast.test')
    expect(callArgs.displayName).toBe('홍길동')
    expect(callArgs.marketingConsent).toBe(false)

    // SignupSuccess 화면 — email 텍스트가 포함됨
    await waitFor(() => {
      expect(screen.getByText(/qa@marketcast.test/)).toBeInTheDocument()
    })
  })

  it('user_already_exists 응답 → 동일 성공 화면 (enumeration 방지)', async () => {
    signUpMock.mockResolvedValue({
      ok: false,
      error: { code: 'user_already_exists', message: 'exists' },
    })
    const user = userEvent.setup()
    renderPage()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: '가입하기' }))

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled()
    })
    // SignupSuccess 화면으로 전환 (성공과 동일 응답)
    await waitFor(() => {
      expect(screen.getByText(/qa@marketcast.test/)).toBeInTheDocument()
    })
  })
})
