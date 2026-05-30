import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui'
import type { ReactNode } from 'react'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import type {
  ShippingPrintOrder,
  MarkWaybillPrintedResponse,
  MarkWaybillPrintedRequest,
} from '../types/shipping-schema'
import { ShippingApiError } from '../api/shipping-api'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

type PrintListResult = UseQueryResult<ShippingPrintOrder[], unknown>
const mockPrintList = vi.fn<[], Partial<PrintListResult>>()
vi.mock('../hooks/useShippingPrintList', () => ({
  useShippingPrintList: () => mockPrintList(),
}))

const markMutate = vi.fn()
vi.mock('../hooks/useMarkWaybillPrinted', () => ({
  useMarkWaybillPrinted: (): Partial<
    UseMutationResult<MarkWaybillPrintedResponse, ShippingApiError, MarkWaybillPrintedRequest>
  > => ({ mutate: markMutate, isPending: false }),
}))

// logen 자격증명 status hook 모킹 — 기본은 hasCredentials=true (경고 미표시).
vi.mock('@/features/settings/shipping', () => ({
  useLogenCredentialsStatus: () => ({
    data: { hasCredentials: true, hasSenderInfo: true, lastVerifiedAt: null, lastErrorAt: null, lastErrorCode: null },
    isLoading: false,
    isError: false,
  }),
}))

import { ShippingPrintPage } from '../pages/ShippingPrintPage'

const ORDER: ShippingPrintOrder = {
  orderId: '00000000-0000-0000-0000-000000000001',
  marketId: 'naver',
  marketOrderNo: 'NV-1001',
  productName: '테스트 상품',
  buyerName: '홍길동',
  waybillNumber: 'WB-12345',
  shippingStatus: 'logen_registered',
  registeredAt: '2026-05-20T00:00:00.000Z',
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<ShippingPrintPage />, { wrapper })
}

describe('ShippingPrintPage (n52)', () => {
  beforeEach(() => {
    mockPrintList.mockReset()
    markMutate.mockReset()
  })

  it('loading: 스켈레톤 / 테이블 미렌더', () => {
    mockPrintList.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('empty: 안내 문구', () => {
    mockPrintList.mockReturnValue({ isLoading: false, isError: false, data: [] })
    renderPage()
    expect(screen.getByText(/출력 대기 중인 운송장이 없습니다/)).toBeInTheDocument()
  })

  it('error: ErrorMessage + 다시 시도', () => {
    mockPrintList.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ShippingApiError({ code: 'internal', message: 'boom' }),
      data: undefined,
    })
    renderPage()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('data: 운송장번호 표시 + [출력 완료] 클릭 → markWaybillPrinted 호출', async () => {
    const user = userEvent.setup()
    mockPrintList.mockReturnValue({ isLoading: false, isError: false, data: [ORDER] })
    renderPage()
    expect(screen.getByText('WB-12345')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /출력 완료/ })
    await user.click(button)
    await waitFor(() => expect(markMutate).toHaveBeenCalledTimes(1))
    expect(markMutate).toHaveBeenCalledWith(
      { orderIds: [ORDER.orderId] },
      expect.anything(),
    )
  })

  it('disabled: 주문 0건이면 [출력 완료] 버튼 disabled', () => {
    mockPrintList.mockReturnValue({ isLoading: false, isError: false, data: [] })
    renderPage()
    const button = screen.getByRole('button', { name: /출력 완료/ })
    expect(button).toBeDisabled()
  })
})
