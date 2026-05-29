import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui'
import type { OrderDetail } from '@/lib/schemas/orders'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

const mockDetail = vi.fn<[], Partial<UseQueryResult<OrderDetail | null, Error>>>()
vi.mock('../hooks/useOrderDetail', () => ({
  useOrderDetail: () => mockDetail(),
}))

vi.mock('../hooks/useManualResolveWaybill', () => ({
  useManualResolveWaybill: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

import { OrderDetailPage } from '../pages/OrderDetailPage'

function renderPage(orderId = '11111111-1111-1111-1111-111111111111'): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
          <Routes>
            <Route path="/orders/:orderId" element={children} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<OrderDetailPage />, { wrapper })
}

function makeDetail(overrides?: Partial<OrderDetail['order']>): OrderDetail {
  return {
    order: {
      id: '11111111-1111-1111-1111-111111111111',
      sellerId: '22222222-2222-2222-2222-222222222222',
      externalOrderId: 'A-100',
      marketId: 'naver',
      productName: '시그니처 토트백',
      productOption: '블랙 / Free',
      quantity: 2,
      buyerMaskedName: '홍*동',
      buyerMaskedPhone: '010-****-1234',
      shippingAddressMasked: '서울특별시 ****',
      shippingStatus: 'collected',
      marketDispatchStatus: 'pending',
      waybillNumber: null,
      logenErrorMessage: null,
      orderedAt: '2026-05-21T01:00:00Z',
      collectedAt: '2026-05-21T01:05:00Z',
      logenRegisteredAt: null,
      waybillPrintedAt: null,
      trackingSubmittedAt: null,
      updatedAt: '2026-05-21T01:05:00Z',
      ...overrides,
    },
  }
}

beforeEach(() => {
  mockDetail.mockReset()
})

describe('OrderDetailPage 4상태', () => {
  it('loading: 스켈레톤', () => {
    mockDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderPage()
    expect(screen.getByRole('status', { name: '주문 상세 불러오는 중' })).toBeInTheDocument()
  })

  it('error: ErrorMessage + 목록으로 링크', () => {
    mockDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('주문 상세를 불러오지 못했습니다')
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute('href', '/orders/list')
  })

  it('empty (notFound): 안내 + 목록으로 링크', () => {
    mockDetail.mockReturnValue({ data: null, isLoading: false, isError: false })
    renderPage()
    // PageHeader subtitle + body 둘 다 동일 메시지 노출 — 본문/링크 동시 검증
    expect(screen.getAllByText('주문을 찾을 수 없습니다').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: '목록으로' })).toHaveAttribute(
      'href',
      '/orders/list',
    )
  })

  it('data: 상품명/주문번호/타임라인/수동 트리거 disabled (logen_failed 아님)', () => {
    mockDetail.mockReturnValue({ data: makeDetail(), isLoading: false, isError: false })
    renderPage()
    expect(screen.getByRole('heading', { name: '시그니처 토트백' })).toBeInTheDocument()
    expect(screen.getByText('#A-100')).toBeInTheDocument()
    expect(screen.getByLabelText('배송 진행 상태')).toBeInTheDocument()
    const trigger = screen.getByTestId('order-manual-resolve-trigger')
    expect(trigger).toBeDisabled()
  })

  it('data (logen_failed): 수동 트리거 활성 + 안내 노출', () => {
    mockDetail.mockReturnValue({
      data: makeDetail({
        shippingStatus: 'logen_failed',
        logenErrorMessage: '주소 형식 오류',
      }),
      isLoading: false,
      isError: false,
    })
    renderPage()
    const trigger = screen.getByTestId('order-manual-resolve-trigger')
    expect(trigger).toBeEnabled()
    expect(screen.getByText('주소 형식 오류')).toBeInTheDocument()
  })

  it('data (coupang): 안심번호 배지가 buyer 표시 옆에 렌더된다', () => {
    mockDetail.mockReturnValue({
      data: makeDetail({ marketId: 'coupang' }),
      isLoading: false,
      isError: false,
    })
    renderPage()
    expect(
      screen.getByRole('button', { name: '안심번호 안내' }),
    ).toBeInTheDocument()
  })

  it('data (naver): 안심번호 배지가 렌더되지 않는다', () => {
    mockDetail.mockReturnValue({
      data: makeDetail({ marketId: 'naver' }),
      isLoading: false,
      isError: false,
    })
    renderPage()
    expect(
      screen.queryByRole('button', { name: '안심번호 안내' }),
    ).not.toBeInTheDocument()
  })
})
