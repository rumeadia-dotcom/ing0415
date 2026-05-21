import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import type * as ApiModule from '../api/shipping-settings-api'

const fetchStatusMock = vi.fn()
const fetchAutoMock = vi.fn()
const setAutoMock = vi.fn()

vi.mock('../api/shipping-settings-api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../api/shipping-settings-api')
  return {
    ...actual,
    fetchLogenCredentialsStatus: () => fetchStatusMock(),
    fetchAutoDispatchSetting: () => fetchAutoMock(),
    setAutoDispatchSetting: (v: boolean) => setAutoMock(v),
  }
})

import { SettingsShippingPage } from '../pages/SettingsShippingPage'

function renderPage(): void {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<SettingsShippingPage />, { wrapper })
}

describe('SettingsShippingPage (n58)', () => {
  beforeEach(() => {
    fetchStatusMock.mockReset()
    fetchAutoMock.mockReset()
    setAutoMock.mockReset()
  })

  it('loading: 스켈레톤 표시', async () => {
    // never-resolving promise 로 로딩 상태 유지
    fetchStatusMock.mockImplementation(() => new Promise(() => undefined))
    fetchAutoMock.mockImplementation(() => new Promise(() => undefined))
    renderPage()
    expect(await screen.findByLabelText(/배송 설정을 불러오는 중/)).toBeInTheDocument()
  })

  it('empty: 자격증명 미등록 → 미연결 배지', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: false,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })
    fetchAutoMock.mockResolvedValue({ autoDispatchAfterPrint: false })
    renderPage()
    expect(await screen.findByText('미연결')).toBeInTheDocument()
    expect(await screen.findByText('입력 필요')).toBeInTheDocument()
  })

  it('data: 자격증명·발송인 모두 완료 → 연결됨/입력 완료', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: true,
      hasSenderInfo: true,
      lastVerifiedAt: '2026-05-20T00:00:00.000Z',
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: {
        senderName: 'A',
        senderAddress: '서울',
        senderPhone: '010-1234-5678',
        fareTy: 'C',
        dlvFare: 2500,
      },
    })
    fetchAutoMock.mockResolvedValue({ autoDispatchAfterPrint: true })
    renderPage()
    expect(await screen.findByText('연결됨')).toBeInTheDocument()
    expect(await screen.findByText('입력 완료')).toBeInTheDocument()
    // 토글 ON 표시 (aria-checked=true)
    const sw = await screen.findByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('error: status fetch 실패 시 ErrorMessage', async () => {
    fetchStatusMock.mockRejectedValue(new Error('boom'))
    fetchAutoMock.mockResolvedValue({ autoDispatchAfterPrint: false })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/예상치 못한 오류가 발생했습니다/)).toBeInTheDocument()
    })
  })

  it('disabled 토글: 자격증명/발송인 미완료면 disabled + blocking reasons 표시', async () => {
    fetchStatusMock.mockResolvedValue({
      hasCredentials: false,
      hasSenderInfo: false,
      lastVerifiedAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      senderInfo: null,
    })
    fetchAutoMock.mockResolvedValue({ autoDispatchAfterPrint: false })
    renderPage()
    const sw = await screen.findByRole('switch')
    expect(sw).toBeDisabled()
    // blocking reasons 적어도 1개 (자격증명 또는 발송인 누락 사유)
    expect(screen.getAllByText(/입력|자격증명/i).length).toBeGreaterThan(0)
  })
})
