import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import type { MarketResult, RegistrationJob } from '@/lib/schemas/registration'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

type JobQueryResult = UseQueryResult<{ job: RegistrationJob; results: MarketResult[] }, unknown>
const mockJobHook = vi.fn<[], Partial<JobQueryResult>>()
vi.mock('../hooks/useRegistrationJob', () => ({
  useRegistrationJob: () => mockJobHook(),
}))

const retryMutate = vi.fn()
const startMutate = vi.fn()
vi.mock('../hooks/useRegistrationRetry', () => ({
  useRegistrationRetry: (): Partial<UseMutationResult<unknown, unknown, unknown, unknown>> => ({ mutate: retryMutate, isPending: false }),
}))
vi.mock('../hooks/useRegistrationStart', () => ({
  useRegistrationStart: (): Partial<UseMutationResult<unknown, unknown, unknown, unknown>> => ({ mutate: startMutate, isPending: false }),
}))

import { StepResultPage } from '../pages/StepResultPage'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import type { Step1Draft } from '../store/useRegisterFormStore'

const JOB_ID = '00000000-0000-0000-0000-0000000000d4'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/register/result/${JOB_ID}`]}>
        <Routes>
          <Route path="/register/result/:jobId" element={children} />
          <Route path="/history" element={<div>history</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<StepResultPage />, { wrapper })
}

function makeJob(status: RegistrationJob['status']): RegistrationJob {
  return {
    id: JOB_ID,
    sellerId: '00000000-0000-0000-0000-000000000aa1',
    productId: '00000000-0000-0000-0000-0000000000c3',
    status,
    retryCount: 0,
    errorSummary: null,
    parentJobId: null,
    createdAt: '2026-05-20T00:00:00.000Z',
    startedAt: '2026-05-20T00:00:01.000Z',
    completedAt: null,
  }
}

function makeResult(idx: number, marketId: 'naver' | 'coupang', marketStatus: MarketResult['marketStatus']): MarketResult {
  return {
    id: `00000000-0000-0000-0000-0000000000${idx.toString().padStart(2, '0')}`,
    jobId: JOB_ID,
    marketId,
    marketAccountId: '00000000-0000-0000-0000-0000000000a1',
    marketStatus,
    externalProductId: marketStatus === 'success' ? 'ext-1' : null,
    productUrl: marketStatus === 'success' ? 'https://example.test/p' : null,
    errorCode: marketStatus === 'failed' ? 'market_unavailable' : null,
    errorMessage: null,
    attemptCount: 1,
    excluded: false,
    lastAttemptedAt: '2026-05-20T00:00:02.000Z',
  }
}

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

describe('StepResultPage', () => {
  beforeEach(() => {
    retryMutate.mockReset()
    startMutate.mockReset()
    mockJobHook.mockReset()
    useRegisterFormStore.getState().clear()
  })

  it('로딩: 스켈레톤', () => {
    mockJobHook.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    renderPage()
    expect(screen.queryByText(/마켓별 결과/)).not.toBeInTheDocument()
  })

  it('succeeded: 진행률 + 마켓별 외부 URL', () => {
    mockJobHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        job: makeJob('succeeded'),
        results: [makeResult(1, 'naver', 'success'), makeResult(2, 'coupang', 'success')],
      },
    })
    renderPage()
    expect(screen.getAllByText('성공').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByRole('link', { name: /외부 상품 보기/ })).toHaveLength(2)
  })

  it('partial: 배너 + 전체 재시도 클릭 → useRegistrationRetry 호출', async () => {
    const user = userEvent.setup()
    mockJobHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        job: makeJob('partial'),
        results: [makeResult(1, 'naver', 'success'), makeResult(2, 'coupang', 'failed')],
      },
    })
    renderPage()
    expect(screen.getByText(/일부 마켓 등록이 실패/)).toBeInTheDocument()
    const retryAll = screen.getByRole('button', { name: /전체 재시도 \(1개\)/ })
    await user.click(retryAll)
    await waitFor(() => expect(retryMutate).toHaveBeenCalledTimes(1))
    expect(retryMutate).toHaveBeenCalledWith({ jobId: JOB_ID }, expect.anything())
  })

  describe('쿠팡 수량구간 fallback 경고 배너', () => {
    it('quantity_tiered + coupang 결과 포함 → 경고 배너 렌더', () => {
      // store 에 step1(quantity_tiered) + 쿠팡 선택 설정
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
      useRegisterFormStore.getState().setSelections([
        { marketId: 'coupang', marketAccountId: '00000000-0000-0000-0000-0000000000a2' },
      ])
      mockJobHook.mockReturnValue({
        isLoading: false,
        isError: false,
        data: {
          job: makeJob('succeeded'),
          results: [makeResult(1, 'coupang', 'success')],
        },
      })
      renderPage()
      // 경고 배너의 구체적인 텍스트로 확인 (마켓 카드의 "쿠팡" 라벨과 구분)
      expect(screen.getByText(/박스당 단일 배송비/)).toBeInTheDocument()
    })

    it('quantity_tiered + coupang marketOverride 설정 시 → 배너 미표시', () => {
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
          marketOverrides: {
            coupang: { feeType: 'paid', baseFee: 3000 },
          },
        },
      })
      useRegisterFormStore.getState().setSelections([
        { marketId: 'coupang', marketAccountId: '00000000-0000-0000-0000-0000000000a2' },
      ])
      mockJobHook.mockReturnValue({
        isLoading: false,
        isError: false,
        data: {
          job: makeJob('succeeded'),
          results: [makeResult(1, 'coupang', 'success')],
        },
      })
      renderPage()
      expect(screen.queryByText(/박스당 단일 배송비/)).not.toBeInTheDocument()
    })

    it('step1=null (새로고침) → 배너 미표시, 크래시 없음', () => {
      // store clear 상태 (step1=null)
      mockJobHook.mockReturnValue({
        isLoading: false,
        isError: false,
        data: {
          job: makeJob('succeeded'),
          results: [makeResult(1, 'coupang', 'success')],
        },
      })
      renderPage()
      expect(screen.queryByText(/박스당 단일 배송비/)).not.toBeInTheDocument()
      // 크래시 없이 마켓별 결과 섹션은 렌더됨
      expect(screen.getByText(/마켓별 결과/)).toBeInTheDocument()
    })

    it('free feeType + coupang → 배너 미표시', () => {
      useRegisterFormStore.getState().setStep1({
        ...STEP1_BASE,
        shippingConfig: {
          method: 'parcel',
          etaDays: 3,
          feeType: 'free',
          baseFee: 0,
          payType: 'prepaid',
          bundleAllowed: false,
        },
      })
      useRegisterFormStore.getState().setSelections([
        { marketId: 'coupang', marketAccountId: '00000000-0000-0000-0000-0000000000a2' },
      ])
      mockJobHook.mockReturnValue({
        isLoading: false,
        isError: false,
        data: {
          job: makeJob('succeeded'),
          results: [makeResult(1, 'coupang', 'success')],
        },
      })
      renderPage()
      expect(screen.queryByText(/박스당 단일 배송비/)).not.toBeInTheDocument()
    })
  })
})
