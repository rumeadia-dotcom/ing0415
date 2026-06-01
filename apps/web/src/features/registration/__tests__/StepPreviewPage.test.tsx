import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import type * as RegistrationApiModule from '../api/registration-api'

const validateMock = vi.fn()
const startMock = vi.fn()
vi.mock('../api/registration-api', async () => {
  const actual = await vi.importActual<typeof RegistrationApiModule>('../api/registration-api')
  return {
    ...actual,
    registrationValidate: (req: unknown) => validateMock(req),
    registrationStart: (req: unknown) => startMock(req),
  }
})

import { StepPreviewPage } from '../pages/StepPreviewPage'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import type { Step1Draft } from '../store/useRegisterFormStore'

const PRODUCT_ID = '00000000-0000-0000-0000-0000000000c3'
const JOB_ID = '00000000-0000-0000-0000-0000000000d4'

const STEP1_BASE: Step1Draft = {
  name: '테스트 상품',
  price: 10000,
  originalPrice: null,
  brand: null,
  manufacturer: null,
  descriptionHtml: null,
  baseCategoryId: 'cat-1',
  shippingConfig: {
    method: 'parcel',
    etaDays: 3,
    feeType: 'free',
    baseFee: 0,
    payType: 'prepaid',
    bundleAllowed: false,
  },
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/register/preview']}>
          <Routes>
            <Route path="/register/info" element={<div>step-info</div>} />
            <Route path="/register/markets" element={<div>step-markets</div>} />
            <Route path="/register/preview" element={children} />
            <Route path="/register/result/:jobId" element={<div>step-result</div>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<StepPreviewPage />, { wrapper })
}

describe('StepPreviewPage', () => {
  beforeEach(() => {
    validateMock.mockReset()
    startMock.mockReset()
    useRegisterFormStore.getState().clear()
  })

  it('productId / selections 없으면 /register/info 회귀', async () => {
    renderPage()
    await screen.findByText('step-info')
  })

  it('검증 통과 + 등록 시작 → /register/result/<jobId>', async () => {
    const user = userEvent.setup()
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    useRegisterFormStore.getState().setSelections([
      { marketId: 'naver', marketAccountId: '00000000-0000-0000-0000-0000000000a1' },
    ])
    validateMock.mockResolvedValueOnce({
      ok: true,
      issues: [],
      previews: [{ marketId: 'naver', payload: {}, estimatedFee: 500 }],
    })
    startMock.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: 'pending',
      marketResults: [
        { marketId: 'naver', marketAccountId: '00000000-0000-0000-0000-0000000000a1', status: 'pending' },
      ],
    })

    renderPage()
    const submit = await screen.findByRole('button', { name: /일괄 등록 실행/ })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    await screen.findByText('step-result')
    expect(startMock).toHaveBeenCalledWith({ productId: PRODUCT_ID, marketIds: ['naver'] })
  })

  it('검증 issue (token_expired) → 등록 시작 disabled', async () => {
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    useRegisterFormStore.getState().setSelections([
      { marketId: 'naver', marketAccountId: '00000000-0000-0000-0000-0000000000a1' },
    ])
    validateMock.mockResolvedValueOnce({
      ok: false,
      issues: [
        { marketId: 'naver', code: 'token_expired', field: 'token', message: 'expired' },
      ],
      previews: [{ marketId: 'naver', payload: {}, estimatedFee: null }],
    })

    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /일괄 등록 실행/ })).toBeDisabled()
    })
    expect(screen.getByText(/재인증/)).toBeInTheDocument()
  })

  it('quantity_tiered box + coupang 선택 → 쿠팡 under-charge 경고 렌더', async () => {
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    useRegisterFormStore.getState().setSelections([
      { marketId: 'coupang', marketAccountId: '00000000-0000-0000-0000-0000000000a2' },
    ])
    useRegisterFormStore.getState().setStep1({
      ...STEP1_BASE,
      shippingConfig: {
        method: 'parcel',
        etaDays: 3,
        feeType: 'quantity_tiered',
        baseFee: 0,
        payType: 'prepaid',
        bundleAllowed: false,
        box: { qtyPerBox: 12, feePerBox: 2500 },
      },
    })
    validateMock.mockResolvedValueOnce({
      ok: true,
      issues: [],
      previews: [{ marketId: 'coupang', payload: {}, estimatedFee: null }],
    })

    renderPage()
    // 쿠팡 under-charge 경고 문구 확인
    await waitFor(() => {
      expect(screen.getByText(/2박스 이상 구매 시 실제 배송비보다 적게 부과/)).toBeInTheDocument()
    })
  })

  it('quantity_tiered box + 11st 선택 → 구간 설명 렌더 (1~12개)', async () => {
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    useRegisterFormStore.getState().setSelections([
      { marketId: '11st', marketAccountId: '00000000-0000-0000-0000-0000000000a3' },
    ])
    useRegisterFormStore.getState().setStep1({
      ...STEP1_BASE,
      shippingConfig: {
        method: 'parcel',
        etaDays: 3,
        feeType: 'quantity_tiered',
        baseFee: 0,
        payType: 'prepaid',
        bundleAllowed: false,
        box: { qtyPerBox: 12, feePerBox: 2500 },
      },
    })
    validateMock.mockResolvedValueOnce({
      ok: true,
      issues: [],
      previews: [{ marketId: '11st', payload: {}, estimatedFee: null }],
    })

    renderPage()
    await waitFor(() => {
      // 11번가 행에 구간 설명이 포함되어 있어야 함
      expect(screen.getByText(/1~12개/)).toBeInTheDocument()
    })
  })
})
