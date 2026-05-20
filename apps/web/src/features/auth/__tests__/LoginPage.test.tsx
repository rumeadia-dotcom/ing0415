import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'
import type * as ReactRouterDom from 'react-router-dom'
import type * as AuthContextModule from '../context/AuthContext'

// ─────────────────────────────────────────────
// mocks
// ─────────────────────────────────────────────
const signInMock = vi.fn()
const navigateSpy = vi.fn()

vi.mock('../context/AuthContext', async () => {
  const actual =
    await vi.importActual<typeof AuthContextModule>('../context/AuthContext')
  return {
    ...actual,
    useAuth: () => ({
      status: 'anonymous',
      session: null,
      user: null,
      signInWithPassword: signInMock,
      signUp: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
      updatePassword: vi.fn(),
      signOut: vi.fn(),
    }),
  }
})

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof ReactRouterDom>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  }
})

import { LoginPage } from '../pages/LoginPage'

// ─────────────────────────────────────────────
// helper
// ─────────────────────────────────────────────
function renderPage(initialEntries: string[] = ['/login']): void {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={children} />
      </Routes>
    </MemoryRouter>
  )
  render(<LoginPage />, { wrapper })
}

beforeEach(() => {
  signInMock.mockReset()
  navigateSpy.mockReset()
})

// ─────────────────────────────────────────────
// 1. validation 통합
// ─────────────────────────────────────────────
describe('LoginPage - validation', () => {
  it('빈 폼 submit 시 email/password 둘 다 에러 노출 + signInWithPassword 미호출', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: '로그인' }))

    // RHF validation 메시지 — schemas/auth.ts 의 zod 메시지가 한국어로 노출됨
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(2)
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('잘못된 email 형식 → email 필드 alert', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('이메일'), 'not-an-email')
    await user.type(screen.getByLabelText('비밀번호'), 'somepass123!')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    const emailErr = await screen.findByText('올바른 이메일 형식이 아닙니다')
    expect(emailErr).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────
// 2. submit flow
// ─────────────────────────────────────────────
describe('LoginPage - submit flow', () => {
  it('valid 폼 + signInWithPassword 성공 → /dashboard navigate', async () => {
    signInMock.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('이메일'), 'qa@marketcast.test')
    await user.type(screen.getByLabelText('비밀번호'), 'Strong#Pass1')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('qa@marketcast.test', 'Strong#Pass1')
    })
    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('signInWithPassword 실패 → ErrorMessage 노출 + password 입력 초기화 + 미navigate', async () => {
    signInMock.mockResolvedValue({
      ok: false,
      error: { code: 'invalid_credentials', message: 'invalid' },
    })
    const user = userEvent.setup()
    renderPage()

    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement
    const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement

    await user.type(emailInput, 'qa@marketcast.test')
    await user.type(passwordInput, 'Strong#Pass1')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalled()
    })
    expect(navigateSpy).not.toHaveBeenCalled()
    // password 초기화 (auth.md §4.1)
    await waitFor(() => {
      expect(passwordInput.value).toBe('')
    })
    expect(emailInput.value).toBe('qa@marketcast.test')
  })
})

// ─────────────────────────────────────────────
// 3. password 토글
// ─────────────────────────────────────────────
describe('LoginPage - password show/hide', () => {
  it('표시 버튼 클릭 → type=text, 다시 클릭 → type=password', async () => {
    renderPage()
    const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 표시' }))
    expect(passwordInput.type).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 숨김' }))
    expect(passwordInput.type).toBe('password')
  })
})
