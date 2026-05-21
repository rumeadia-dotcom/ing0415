import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type * as ReactRouterDom from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui'
import type { ReactNode } from 'react'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import type {
  ShippingDispatchPreview,
  ShippingDispatchStartRequest,
  ShippingDispatchStartResponse,
} from '../types/shipping-schema'
import { ShippingApiError } from '../api/shipping-api'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

type PreviewResult = UseQueryResult<ShippingDispatchPreview, unknown>
const mockPreview = vi.fn<[], Partial<PreviewResult>>()
vi.mock('../hooks/useShippingDispatchPreview', () => ({
  useShippingDispatchPreview: () => mockPreview(),
}))

const startMutate = vi.fn()
vi.mock('../hooks/useShippingDispatchStart', () => ({
  useShippingDispatchStart: (): Partial<
    UseMutationResult<ShippingDispatchStartResponse, ShippingApiError, ShippingDispatchStartRequest>
  > => ({ mutate: startMutate, isPending: false }),
}))

import { ShippingDispatchPage } from '../pages/ShippingDispatchPage'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<ShippingDispatchPage />, { wrapper })
}

describe('ShippingDispatchPage (n53)', () => {
  beforeEach(() => {
    mockPreview.mockReset()
    startMutate.mockReset()
    navigateMock.mockReset()
  })

  it('loading: 스켈레톤', () => {
    mockPreview.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.queryByText('제출 미리보기')).not.toBeInTheDocument()
  })

  it('empty: printed=0 이면 안내 + [제출 시작] disabled', () => {
    mockPreview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { totalOrders: 0, printedOrders: 0, unprintedOrders: 0, marketGroups: [] },
    })
    renderPage()
    expect(screen.getByText(/제출 가능한 주문이 없습니다/)).toBeInTheDocument()
    const startButton = screen.getByRole('button', { name: /제출 시작/ })
    expect(startButton).toBeDisabled()
  })

  it('error: ErrorMessage + 다시 시도', () => {
    mockPreview.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ShippingApiError({ code: 'internal', message: 'preview boom' }),
      data: undefined,
    })
    renderPage()
    expect(screen.getByText(/preview boom/)).toBeInTheDocument()
  })

  it('partial(unprinted>0): 경고 배너 표시 (강제 차단 X)', () => {
    mockPreview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        totalOrders: 10,
        printedOrders: 8,
        unprintedOrders: 2,
        marketGroups: [{ marketId: 'naver', orderCount: 5 }, { marketId: 'coupang', orderCount: 3 }],
      },
    })
    renderPage()
    expect(screen.getByText(/출력 미완료 주문이/)).toBeInTheDocument()
    const startButton = screen.getByRole('button', { name: /제출 시작/ })
    expect(startButton).not.toBeDisabled()
  })

  it('data: [제출 시작] → mutation 호출 + 결과 페이지 이동', async () => {
    const user = userEvent.setup()
    startMutate.mockImplementation((_req, opts: { onSuccess?: (r: ShippingDispatchStartResponse) => void }) => {
      opts.onSuccess?.({
        jobId: '00000000-0000-0000-0000-0000000000ff',
        status: 'pending',
        totalOrders: 5,
      })
    })
    mockPreview.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        totalOrders: 5,
        printedOrders: 5,
        unprintedOrders: 0,
        marketGroups: [{ marketId: 'naver', orderCount: 5 }],
      },
    })
    renderPage()
    const startButton = screen.getByRole('button', { name: /제출 시작/ })
    await user.click(startButton)
    await waitFor(() => expect(startMutate).toHaveBeenCalledTimes(1))
    expect(navigateMock).toHaveBeenCalledWith(
      '/shipping/dispatch/00000000-0000-0000-0000-0000000000ff/result',
    )
  })
})
