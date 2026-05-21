import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query'
import type { OrdersListPage as OrdersListPageType } from '../api/orders-api'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

const mockList =
  vi.fn<[], Partial<UseInfiniteQueryResult<InfiniteData<OrdersListPageType>, Error>>>()
vi.mock('../hooks/useOrders', () => ({
  useOrders: () => mockList(),
}))

import { OrdersListPage } from '../pages/OrdersListPage'

function renderPage(initialEntries: string[] = ['/orders/list']): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<OrdersListPage />, { wrapper })
}

function makePage(
  items: OrdersListPageType['items'],
  total = 0,
): InfiniteData<OrdersListPageType> {
  return {
    pages: [{ items, totalCount: total, nextCursor: null }],
    pageParams: [null],
  }
}

beforeEach(() => {
  mockList.mockReset()
})

describe('OrdersListPage 4상태', () => {
  it('loading: 스켈레톤 노출', () => {
    mockList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('status', { name: '주문 목록 불러오는 중' })).toBeInTheDocument()
  })

  it('error: ErrorMessage 노출', () => {
    mockList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network down'),
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('주문 목록을 불러오지 못했습니다')
  })

  it('empty (필터 디폴트, 0건): "아직 주문이 없습니다"', () => {
    mockList.mockReturnValue({
      data: makePage([], 0),
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('아직 주문이 없습니다')).toBeInTheDocument()
  })

  it('empty (필터 적용 결과 0건): "조건에 맞는 주문이 없습니다"', () => {
    mockList.mockReturnValue({
      data: makePage([], 0),
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage(['/orders/list?market=naver&status=collected'])
    expect(screen.getByText('조건에 맞는 주문이 없습니다')).toBeInTheDocument()
  })

  it('data: 주문 row + 총 건수 헤더 + 상세 링크', () => {
    mockList.mockReturnValue({
      data: makePage(
        [
          {
            id: '11111111-1111-1111-1111-111111111111',
            externalOrderId: 'A-100',
            marketId: 'naver',
            productName: '시그니처 토트백',
            buyerMaskedName: '홍*동',
            shippingStatus: 'collected',
            marketDispatchStatus: 'pending',
            waybillNumber: null,
            orderedAt: '2026-05-21T01:00:00Z',
            updatedAt: '2026-05-21T01:00:00Z',
          },
        ],
        9,
      ),
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByText(/총 9건/)).toBeInTheDocument()
    // 데스크탑 + 모바일 row 양쪽 렌더되므로 1+
    expect(screen.getAllByText('시그니처 토트백').length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByRole('link', { name: '시그니처 토트백' })[0],
    ).toHaveAttribute('href', '/orders/11111111-1111-1111-1111-111111111111')
  })
})
