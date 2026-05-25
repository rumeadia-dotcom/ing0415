import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import type * as MarketsApiModule from '../api/markets-api'

const oauthStartMock = vi.fn()
const connectMarketMock = vi.fn()
vi.mock('../api/markets-api', async () => {
  const actual = await vi.importActual<typeof MarketsApiModule>('../api/markets-api')
  return {
    ...actual,
    oauthStart: (req: unknown) => oauthStartMock(req),
    connectMarket: (req: unknown) => connectMarketMock(req),
  }
})

import { MarketsConnectProviderPage } from '../pages/MarketsConnectProviderPage'
import { MarketApiInvocationError } from '../api/markets-api'

function renderAt(path: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/markets/connect/:provider" element={children} />
          <Route path="/markets" element={<div>markets-list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<MarketsConnectProviderPage />, { wrapper })
}

describe('MarketsConnectProviderPage', () => {
  beforeEach(() => {
    oauthStartMock.mockReset()
    connectMarketMock.mockReset()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, assign: vi.fn() },
    })
  })

  it('OAuth(naver): 라벨 입력 후 제출 → authorizeUrl 로 redirect', async () => {
    oauthStartMock.mockResolvedValueOnce({
      authorizeUrl: 'https://nid.naver.com/oauth2/authorize?fake',
      correlationId: '00000000-0000-0000-0000-000000000aaa',
    })

    const user = userEvent.setup()
    renderAt('/markets/connect/naver')

    await user.type(screen.getByLabelText(/계정 라벨/), '메인 스토어')
    await user.click(screen.getByRole('button', { name: /네이버 스마트스토어 로그인으로 이동/ }))

    await waitFor(() => expect(oauthStartMock).toHaveBeenCalledTimes(1))
    expect(window.location.assign).toHaveBeenCalledWith('https://nid.naver.com/oauth2/authorize?fake')
  })

  it('HMAC(coupang): 성공 시 markets 로 navigate', async () => {
    connectMarketMock.mockResolvedValueOnce({
      accountId: '00000000-0000-0000-0000-000000000001',
      market: 'coupang',
      accountLabel: '메인',
      status: 'active',
      connectedAt: '2026-05-20T00:00:00.000+09:00',
      correlationId: '00000000-0000-0000-0000-000000000bbb',
    })

    const user = userEvent.setup()
    renderAt('/markets/connect/coupang')

    await user.type(screen.getByLabelText(/계정 라벨/), '메인')
    await user.type(screen.getByLabelText(/Access Key/), 'akey-001')
    await user.type(screen.getByLabelText(/Secret Key/), 'secret-001')
    await user.type(screen.getByLabelText(/Vendor ID/), 'A00012345')
    await user.click(screen.getByRole('button', { name: /^연결$/ }))

    await waitFor(() => expect(connectMarketMock).toHaveBeenCalledTimes(1))
    await screen.findByText('markets-list')
  })

  it('HMAC(coupang): duplicate_label 에러 → 한국어 메시지 인라인 표시', async () => {
    connectMarketMock.mockRejectedValueOnce(
      new MarketApiInvocationError({
        code: 'duplicate_label',
        message: 'dup',
        correlationId: '00000000-0000-0000-0000-000000000ccc',
      }),
    )

    const user = userEvent.setup()
    renderAt('/markets/connect/coupang')

    await user.type(screen.getByLabelText(/계정 라벨/), '메인')
    await user.type(screen.getByLabelText(/Access Key/), 'akey-001')
    await user.type(screen.getByLabelText(/Secret Key/), 'secret-001')
    await user.type(screen.getByLabelText(/Vendor ID/), 'A00012345')
    await user.click(screen.getByRole('button', { name: /^연결$/ }))

    expect(await screen.findByText(/이미 사용 중인 라벨입니다/)).toBeInTheDocument()
  })

  it('api_key(11st): API Key 입력 폼 + 연결 CTA + 발급 가이드 (오픈 준비중 문구 없음)', () => {
    renderAt('/markets/connect/11st')
    // 폼 헤더 — 11번가 계정 연결 + API Key 방식 안내
    expect(screen.getByRole('heading', { name: /11번가.*계정 연결/ })).toBeInTheDocument()
    expect(screen.getByText(/API Key 방식/)).toBeInTheDocument()
    // API Key SecretField + 연결 CTA
    expect(screen.getByLabelText(/API Key/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^연결$/ })).toBeInTheDocument()
  })
})
