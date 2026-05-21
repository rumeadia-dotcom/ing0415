import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import type {
  ShippingJob,
  ShippingJobMarketResult,
  ShippingDispatchRetryRequest,
  ShippingDispatchRetryResponse,
} from '../types/shipping-schema'
import { ShippingApiError } from '../api/shipping-api'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

type JobResult = UseQueryResult<{ job: ShippingJob; results: ShippingJobMarketResult[] }, unknown>
const mockJob = vi.fn<[], Partial<JobResult>>()
vi.mock('../hooks/useShippingJob', () => ({
  useShippingJob: () => mockJob(),
}))

const retryMutate = vi.fn()
vi.mock('../hooks/useShippingJobRetry', () => ({
  useShippingJobRetry: (): Partial<
    UseMutationResult<ShippingDispatchRetryResponse, ShippingApiError, ShippingDispatchRetryRequest>
  > => ({ mutate: retryMutate, isPending: false }),
}))

import { ShippingDispatchResultPage } from '../pages/ShippingDispatchResultPage'

const JOB_ID = '00000000-0000-0000-0000-0000000000ab'

function makeJob(status: ShippingJob['status']): ShippingJob {
  return {
    id: JOB_ID,
    sellerId: '00000000-0000-0000-0000-0000000000a1',
    status,
    totalOrders: 10,
    retryCount: 0,
    errorSummary: null,
    parentJobId: null,
    createdAt: '2026-05-20T00:00:00.000Z',
    startedAt: '2026-05-20T00:00:01.000Z',
    completedAt: null,
  }
}

function makeResult(
  idx: number,
  marketId: 'naver' | 'coupang',
  status: ShippingJobMarketResult['status'],
  total = 5,
  success = 0,
  failed = 0,
): ShippingJobMarketResult {
  return {
    id: `00000000-0000-0000-0000-0000000000${idx.toString().padStart(2, '0')}`,
    jobId: JOB_ID,
    marketId,
    marketAccountId: '00000000-0000-0000-0000-0000000000c1',
    status,
    totalOrders: total,
    successOrders: success,
    failedOrders: failed,
    errorCode: status === 'failed' ? 'market_unavailable' : null,
    errorMessage: status === 'failed' ? 'API 응답 오류' : null,
    attemptCount: 1,
    lastAttemptedAt: '2026-05-20T00:00:02.000Z',
  }
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/shipping/dispatch/${JOB_ID}/result`]}>
        <Routes>
          <Route path="/shipping/dispatch/:jobId/result" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<ShippingDispatchResultPage />, { wrapper })
}

describe('ShippingDispatchResultPage (n54+n55+n56)', () => {
  beforeEach(() => {
    mockJob.mockReset()
    retryMutate.mockReset()
  })

  it('loading: 스켈레톤', () => {
    mockJob.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.queryByText('마켓별 결과')).not.toBeInTheDocument()
  })

  it('error: ErrorMessage', () => {
    mockJob.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ShippingApiError({ code: 'internal', message: 'job boom' }),
      data: undefined,
    })
    renderPage()
    expect(screen.getByText(/job boom/)).toBeInTheDocument()
  })

  it('running data: 진행률 + 마켓별 결과', () => {
    mockJob.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        job: makeJob('running'),
        results: [makeResult(1, 'naver', 'in_flight'), makeResult(2, 'coupang', 'in_flight')],
      },
    })
    renderPage()
    expect(screen.getByText('진행률')).toBeInTheDocument()
    expect(screen.getAllByText('진행 중').length).toBeGreaterThan(0)
  })

  it('partial: 배너 + 실패 마켓 재시도 버튼', async () => {
    const user = userEvent.setup()
    mockJob.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        job: makeJob('partial'),
        results: [
          makeResult(1, 'naver', 'success', 5, 5, 0),
          makeResult(2, 'coupang', 'failed', 5, 0, 5),
        ],
      },
    })
    renderPage()
    expect(screen.getByText(/일부 마켓이 실패했습니다/)).toBeInTheDocument()
    // 마켓별 행의 "재시도" 버튼 — 실패한 행에만 보임
    const retryButtons = screen.getAllByRole('button', { name: '재시도' })
    expect(retryButtons).toHaveLength(1)
    const firstButton = retryButtons[0]
    if (!firstButton) throw new Error('retry button not found')
    await user.click(firstButton)
    await waitFor(() => expect(retryMutate).toHaveBeenCalledTimes(1))
    expect(retryMutate).toHaveBeenCalledWith(
      { jobId: JOB_ID, marketResultIds: ['00000000-0000-0000-0000-000000000002'] },
      expect.anything(),
    )
  })
})
