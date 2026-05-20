import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { MarketAccount } from '@/lib/schemas/markets-feature'

// useAuth mock
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

// realtime hook 은 부수효과만 — no-op
vi.mock('../hooks/useMarketAccountsRealtime', () => ({
  useMarketAccountsRealtime: () => undefined,
}))

// useMarketAccounts mock — 각 테스트에서 결과 주입
const mockHook = vi.fn<[], Partial<UseQueryResult<MarketAccount[], unknown>>>()
vi.mock('../hooks/useMarketAccounts', () => ({
  useMarketAccounts: () => mockHook(),
}))

import { MarketsListPage } from '../pages/MarketsListPage'
import { MarketApiInvocationError } from '../api/markets-api'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<MarketsListPage />, { wrapper })
}

describe('MarketsListPage 4상태', () => {
  it('loading: 스켈레톤 렌더 (테이블 / empty 표시 없음)', () => {
    mockHook.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() })
    renderPage()
    expect(screen.queryByText('아직 연결된 마켓이 없습니다.')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('error: ErrorMessage + 다시 시도 버튼', () => {
    const err = new MarketApiInvocationError({
      code: 'internal',
      message: 'boom',
      correlationId: '11111111-1111-1111-1111-111111111111',
    })
    mockHook.mockReturnValue({ isLoading: false, isError: true, error: err, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('마켓 목록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('empty: 0개일 때 CTA 카드', () => {
    mockHook.mockReturnValue({ isLoading: false, isError: false, data: [], refetch: vi.fn() })
    renderPage()
    expect(screen.getByText('아직 연결된 마켓이 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /첫 마켓 연결하기/ })).toHaveAttribute('href', '/markets/connect')
  })

  it('data: 1개 active 행 렌더', () => {
    const account: MarketAccount = {
      id: '00000000-0000-0000-0000-000000000001',
      marketId: 'naver',
      accountLabel: '메인 스토어',
      externalAccountId: null,
      status: 'active',
      connectedAt: '2026-05-20T00:00:00.000+09:00',
      lastVerifiedAt: '2026-05-20T00:00:00.000+09:00',
      lastErrorCode: null,
      lastErrorAt: null,
    }
    mockHook.mockReturnValue({ isLoading: false, isError: false, data: [account], refetch: vi.fn() })
    renderPage()
    // 데스크탑 테이블이 hidden md:block 이지만 jsdom 에서는 보이는 상태로 렌더 — 행이 DOM 에 존재해야 함
    expect(screen.getAllByText('메인 스토어').length).toBeGreaterThan(0)
    expect(screen.getAllByText('활성').length).toBeGreaterThan(0)
  })

  it('partial: 모두 expired/revoked 면 경고 배너', () => {
    const accounts: MarketAccount[] = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        marketId: 'naver',
        accountLabel: '메인',
        externalAccountId: null,
        status: 'expired',
        connectedAt: '2026-05-20T00:00:00.000+09:00',
        lastVerifiedAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ]
    mockHook.mockReturnValue({ isLoading: false, isError: false, data: accounts, refetch: vi.fn() })
    renderPage()
    expect(screen.getByText(/모든 마켓이 재인증 필요/)).toBeInTheDocument()
  })
})
