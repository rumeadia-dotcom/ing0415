import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import type * as ApiModule from '../api/shipping-settings-api'

const fetchStatusMock = vi.fn()
const setCredsMock = vi.fn()
const verifyMock = vi.fn()

vi.mock('../api/shipping-settings-api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../api/shipping-settings-api')
  return {
    ...actual,
    fetchLogenCredentialsStatus: () => fetchStatusMock(),
    setLogenCredentials: (args: unknown) => setCredsMock(args),
    verifyLogenCredential: (req: unknown) => verifyMock(req),
  }
})

import { SettingsShippingLogenPage } from '../pages/SettingsShippingLogenPage'
import { LogenApiInvocationError } from '../api/shipping-settings-api'

function renderPage(): void {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/settings/shipping/logen']}>
        <Routes>
          <Route path="/settings/shipping/logen" element={children} />
          <Route path="/settings/shipping" element={<div>shipping-index</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<SettingsShippingLogenPage />, { wrapper })
}

describe('SettingsShippingLogenPage (n59)', () => {
  beforeEach(() => {
    fetchStatusMock.mockReset()
    setCredsMock.mockReset()
    verifyMock.mockReset()
  })

  it('happy path: 입력 → 저장 → 검증 → 성공 토스트 후 redirect', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: false,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })
    setCredsMock.mockResolvedValue(undefined)
    verifyMock.mockResolvedValue({
      ok: true,
      verifiedAt: '2026-05-20T00:00:00.000Z',
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/userId/), 'LGN_12345')
    await user.type(screen.getByLabelText(/custCd/), 'CUST_67890')
    await user.click(screen.getByRole('button', { name: /저장 후 연결 테스트/ }))

    await waitFor(() => expect(setCredsMock).toHaveBeenCalled())
    await waitFor(() => expect(verifyMock).toHaveBeenCalled())

    // 800ms 후 navigate — setTimeout 자연 진행 대기
    await screen.findByText('shipping-index', undefined, { timeout: 3000 })
  })

  it('verify 실패 - invalid_credentials 한글 메시지', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: false,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })
    setCredsMock.mockResolvedValue(undefined)
    verifyMock.mockRejectedValue(
      new LogenApiInvocationError({
        code: 'invalid_credentials',
        message: 'invalid',
        correlationId: '00000000-0000-0000-0000-000000000001',
      }),
    )

    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText(/userId/), 'LGN_X')
    await user.type(screen.getByLabelText(/custCd/), 'CUST_X')
    await user.click(screen.getByRole('button', { name: /저장 후 연결 테스트/ }))

    await waitFor(() => expect(verifyMock).toHaveBeenCalled())
    expect(
      await screen.findByText(/입력한 자격증명이 유효하지 않습니다/),
    ).toBeInTheDocument()
  })

  it('빈 폼 제출 시 RHF 검증 오류 표시', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: false,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })

    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: /저장 후 연결 테스트/ }))
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(2)
    expect(setCredsMock).not.toHaveBeenCalled()
  })

  it('hasCredentials=true 면 [연결 테스트] 별도 버튼 노출', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: true,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })
    renderPage()
    expect(await screen.findByRole('button', { name: /^연결 테스트$/ })).toBeInTheDocument()
  })
})
