import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

const oauthCallbackMock = vi.fn()
vi.mock('../api/markets-api', async () => {
  const actual = await vi.importActual<typeof MarketsApiModule>('../api/markets-api')
  return {
    ...actual,
    oauthCallback: (req: unknown) => oauthCallbackMock(req),
  }
})

import { OAuthCallbackPage } from '../pages/OAuthCallbackPage'
import { MarketApiInvocationError } from '../api/markets-api'

const validState = 'x'.repeat(32)

function renderAt(path: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/markets/callback/:provider" element={children} />
          <Route path="/markets" element={<div>markets-list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<OAuthCallbackPage />, { wrapper })
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    oauthCallbackMock.mockReset()
  })

  it('성공: mutation 후 /markets 로 redirect', async () => {
    oauthCallbackMock.mockResolvedValueOnce({
      accountId: '00000000-0000-0000-0000-000000000001',
      market: 'naver',
      accountLabel: '메인',
      status: 'active',
      connectedAt: '2026-05-20T00:00:00.000+09:00',
      redirectTo: '/markets',
      correlationId: '00000000-0000-0000-0000-000000000aaa',
    })

    renderAt(`/markets/callback/naver?code=abc&state=${validState}`)
    await screen.findByText('markets-list')
    expect(oauthCallbackMock).toHaveBeenCalledTimes(1)
  })

  it('실패(서버 invalid_code): 한국어 에러 + correlationId', async () => {
    oauthCallbackMock.mockRejectedValueOnce(
      new MarketApiInvocationError({
        code: 'invalid_code',
        message: 'expired',
        correlationId: '11111111-1111-1111-1111-111111111111',
      }),
    )
    renderAt(`/markets/callback/naver?code=abc&state=${validState}`)
    expect(await screen.findByText(/인증 코드가 만료되었거나/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /처음부터 다시 시도/ })).toHaveAttribute('href', '/markets/connect/naver')
  })

  it('code 누락: invoke 호출 없이 즉시 invalid_code 화면', async () => {
    renderAt(`/markets/callback/naver?state=${validState}`)
    await waitFor(() => {
      expect(screen.getByText(/인증 코드가 만료되었거나/)).toBeInTheDocument()
    })
    expect(oauthCallbackMock).not.toHaveBeenCalled()
  })

  it('마켓 측 access_denied: oauth_denied 메시지', async () => {
    renderAt(`/markets/callback/naver?error=access_denied&state=${validState}`)
    await waitFor(() => {
      expect(screen.getByText(/권한 부여를 거부/)).toBeInTheDocument()
    })
    expect(oauthCallbackMock).not.toHaveBeenCalled()
  })
})
