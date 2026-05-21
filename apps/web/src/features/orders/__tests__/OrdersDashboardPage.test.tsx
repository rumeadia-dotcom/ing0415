import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { OrdersSummary } from '@/lib/schemas/orders'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

const mockSummary = vi.fn<[], Partial<UseQueryResult<OrdersSummary, Error>>>()
vi.mock('../hooks/useOrdersSummary', () => ({
  useOrdersSummary: () => mockSummary(),
}))

import { OrdersDashboardPage } from '../pages/OrdersDashboardPage'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<OrdersDashboardPage />, { wrapper })
}

beforeEach(() => {
  mockSummary.mockReset()
})

describe('OrdersDashboardPage 4상태', () => {
  it('loading: 스켈레톤 + by-market 로딩 상태', () => {
    mockSummary.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderPage()
    // by-market 섹션 loading 메시지 (role=status + aria-live)
    expect(screen.getByRole('status')).toHaveTextContent('주문 목록 불러오는 중')
  })

  it('error: ErrorMessage 노출', () => {
    mockSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('summary network down'),
    })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('주문 요약을 불러오지 못했습니다')
  })

  it('empty (모든 카운트 0): "오늘 신규 주문이 없습니다" 표시', () => {
    mockSummary.mockReturnValue({
      data: {
        newOrdersCount: 0,
        logenRegisteredCount: 0,
        waybillPendingCount: 0,
        dispatchSubmittedCount: 0,
        byMarket: [],
      },
      isLoading: false,
      isError: false,
    })
    renderPage()
    expect(screen.getByText('오늘 신규 주문이 없습니다')).toBeInTheDocument()
  })

  it('data: 4종 카운트 + 마켓별 뱃지', () => {
    mockSummary.mockReturnValue({
      data: {
        newOrdersCount: 12,
        logenRegisteredCount: 5,
        waybillPendingCount: 3,
        dispatchSubmittedCount: 4,
        byMarket: [
          { marketId: 'naver', newOrdersCount: 7, pendingCount: 2 },
          { marketId: 'coupang', newOrdersCount: 5, pendingCount: 0 },
        ],
      },
      isLoading: false,
      isError: false,
    })
    renderPage()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('네이버 스마트스토어')).toBeInTheDocument()
    expect(screen.getByText('쿠팡')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '전체 주문 보기' })).toHaveAttribute(
      'href',
      '/orders/list',
    )
    expect(screen.getByRole('link', { name: /운송장 출력/ })).toHaveAttribute(
      'href',
      '/shipping/print',
    )
    expect(screen.getByRole('link', { name: /송장 일괄 제출/ })).toHaveAttribute(
      'href',
      '/shipping/dispatch',
    )
  })
})
