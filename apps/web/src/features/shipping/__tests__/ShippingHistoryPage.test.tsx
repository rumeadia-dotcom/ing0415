import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ShippingJobListItem } from '../types/shipping-schema'
import { ShippingApiError } from '../api/shipping-api'

type JobsResult = UseQueryResult<ShippingJobListItem[], unknown>
const mockJobs = vi.fn<[], Partial<JobsResult>>()
vi.mock('../hooks/useShippingJobs', () => ({
  useShippingJobs: () => mockJobs(),
}))

import { ShippingHistoryPage } from '../pages/ShippingHistoryPage'

const JOB: ShippingJobListItem = {
  id: '00000000-0000-0000-0000-0000000000aa',
  sellerId: '00000000-0000-0000-0000-0000000000a1',
  status: 'succeeded',
  totalOrders: 10,
  retryCount: 0,
  errorSummary: null,
  parentJobId: null,
  createdAt: '2026-05-20T00:00:00.000Z',
  startedAt: '2026-05-20T00:00:01.000Z',
  completedAt: '2026-05-20T00:00:30.000Z',
  successCount: 10,
  failedCount: 0,
  marketIds: ['naver', 'coupang'],
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<ShippingHistoryPage />, { wrapper })
}

describe('ShippingHistoryPage (n57)', () => {
  beforeEach(() => {
    mockJobs.mockReset()
  })

  it('loading: 스켈레톤', () => {
    mockJobs.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('empty: 안내 문구', () => {
    mockJobs.mockReturnValue({ isLoading: false, isError: false, data: [] })
    renderPage()
    expect(screen.getByText(/아직 배송 이력이 없습니다/)).toBeInTheDocument()
  })

  it('error: ErrorMessage', () => {
    mockJobs.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ShippingApiError({ code: 'internal', message: 'history boom' }),
      data: undefined,
    })
    renderPage()
    expect(screen.getByText(/history boom/)).toBeInTheDocument()
  })

  it('data: 행 클릭은 /shipping/dispatch/:jobId/result 로 이동', () => {
    mockJobs.mockReturnValue({ isLoading: false, isError: false, data: [JOB] })
    renderPage()
    const link = screen.getByRole('link', { name: /작업 .* 상세 보기/ })
    expect(link).toHaveAttribute('href', `/shipping/dispatch/${JOB.id}/result`)
  })
})
