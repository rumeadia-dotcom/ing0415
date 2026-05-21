import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'
import type { OrderDetail } from '@/lib/schemas/orders'

const mutateAsync = vi.fn<[unknown], Promise<unknown>>()
vi.mock('../hooks/useManualResolveWaybill', () => ({
  useManualResolveWaybill: () => ({ mutateAsync, isPending: false }),
}))

const toastSuccess = vi.fn<[string], undefined>()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: [string]) => toastSuccess(...args),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { OrderManualResolveDialog } from '../components/OrderManualResolveDialog'

function makeOrder(overrides?: Partial<OrderDetail['order']>): OrderDetail['order'] {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    sellerId: '22222222-2222-2222-2222-222222222222',
    externalOrderId: 'A-100',
    marketId: 'naver',
    productName: '상품',
    productOption: null,
    quantity: 1,
    buyerMaskedName: '홍*동',
    buyerMaskedPhone: null,
    shippingAddressMasked: '서울 ****',
    shippingStatus: 'logen_failed',
    marketDispatchStatus: 'pending',
    waybillNumber: null,
    logenErrorMessage: '에러',
    orderedAt: '2026-05-21T01:00:00Z',
    collectedAt: '2026-05-21T01:05:00Z',
    logenRegisteredAt: null,
    waybillPrintedAt: null,
    trackingSubmittedAt: null,
    updatedAt: '2026-05-21T01:05:00Z',
    ...overrides,
  }
}

function renderDialog(order: OrderDetail['order']): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  )
  render(<OrderManualResolveDialog order={order} />, { wrapper })
}

beforeEach(() => {
  mutateAsync.mockReset()
  toastSuccess.mockReset()
})

describe('OrderManualResolveDialog', () => {
  it('trigger 비활성 (logen_failed 아닌 경우)', () => {
    renderDialog(makeOrder({ shippingStatus: 'collected' }))
    expect(screen.getByTestId('order-manual-resolve-trigger')).toBeDisabled()
  })

  it('trigger 활성 (logen_failed) + 다이얼로그 오픈 + 빈 입력 검증', async () => {
    const user = userEvent.setup()
    renderDialog(makeOrder())
    await user.click(screen.getByTestId('order-manual-resolve-trigger'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // 빈 입력으로 submit
    await user.click(screen.getByRole('button', { name: '확인' }))
    // 검증 오류 alert
    expect(
      await screen.findByText(/운송장번호는 8자리 이상이어야 합니다/),
    ).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('정상 입력 → mutateAsync 호출 + 성공 토스트', async () => {
    const user = userEvent.setup()
    mutateAsync.mockResolvedValue({
      orderId: '11111111-1111-1111-1111-111111111111',
      waybillNumber: '123456789012',
    })
    renderDialog(makeOrder())
    await user.click(screen.getByTestId('order-manual-resolve-trigger'))
    const waybillInput = screen.getByLabelText('운송장번호')
    await user.type(waybillInput, '123456789012')
    await user.click(screen.getByRole('button', { name: '확인' }))
    // assert mutation called
    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync.mock.calls[0]?.[0]).toMatchObject({
      orderId: '11111111-1111-1111-1111-111111111111',
      waybillNumber: '123456789012',
    })
    // toast.success 호출 확인
    expect(toastSuccess).toHaveBeenCalledWith('운송장이 등록되었습니다')
  })

  it('mutation 실패 → ErrorMessage 노출', async () => {
    const user = userEvent.setup()
    mutateAsync.mockRejectedValue(new Error('rpc unavailable'))
    renderDialog(makeOrder())
    await user.click(screen.getByTestId('order-manual-resolve-trigger'))
    await user.type(screen.getByLabelText('운송장번호'), '123456789012')
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(
      await screen.findByText('운송장 수동 입력에 실패했습니다. 잠시 후 다시 시도해주세요'),
    ).toBeInTheDocument()
  })
})
