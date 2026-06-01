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

vi.mock('../hooks/useDuplicateProductCheck', () => ({
  useDuplicateProductCheck: () => ({ data: { duplicate: false, productId: null } }),
}))

vi.mock('../hooks/useShippingPolicies', () => ({
  useShippingPolicies: () => ({
    isLoading: false,
    isError: false,
    data: [],
  }),
}))

const upsertMutateMock = vi.fn()
vi.mock('../hooks/useProductDraft', () => ({
  useUpsertProductDraft: () => ({
    isPending: false,
    mutate: (input: unknown, opts: { onSuccess: (d: { productId: string }) => void }) => {
      upsertMutateMock(input)
      opts.onSuccess({ productId: '00000000-0000-0000-0000-0000000000b2' })
    },
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { StepInfoPage } from '../pages/StepInfoPage'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { DEFAULT_SHIPPING_CONFIG } from '@/lib/schemas/shipping-config'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/register/info']}>
          <Routes>
            <Route path="/register/info" element={children} />
            <Route path="/register/images" element={<div>step-images</div>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<StepInfoPage />, { wrapper })
}

describe('StepInfoPage', () => {
  beforeEach(() => {
    useRegisterFormStore.getState().clear()
  })

  it('빈 폼은 제출 버튼 disabled (blockingReasons)', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /다음: 이미지/ })).toBeDisabled()
    })
  })

  it('필수값 채우면 제출 → store 저장 + /register/images 이동', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^상품명$/), '테스트 텀블러')
    await user.clear(screen.getByLabelText(/판매가/))
    await user.type(screen.getByLabelText(/판매가/), '15000')
    await user.type(screen.getByLabelText(/내부 카테고리/), '가전 > 주방가전')

    // 배송 설정은 기본값(무료배송)이 valid 라 추가 입력 없이 제출 가능.
    // 제출 버튼은 blocking 여부에 따라 다른 엘리먼트로 렌더되므로 매번 재조회한다.
    // ShippingConfigSection 마운트로 인한 RHF 재검증이 jsdom 에서 느려 timeout 여유를 둔다.
    await waitFor(
      () => expect(screen.getByRole('button', { name: /다음: 이미지/ })).toBeEnabled(),
      { timeout: 3000 },
    )
    await user.click(screen.getByRole('button', { name: /다음: 이미지/ }))

    await screen.findByText('step-images')
    const stored = useRegisterFormStore.getState().step1
    expect(stored?.name).toBe('테스트 텀블러')
    expect(stored?.price).toBe(15000)
    // 폼은 기본 무료배송 config 를 그대로 저장한다 (advanced 빈 필드는 null 로 직렬화될 수 있음).
    expect(stored?.shippingConfig).toMatchObject(DEFAULT_SHIPPING_CONFIG)
    expect(stored?.shippingConfig.feeType).toBe('free')
  })

  it('판매가가 100 미만이면 zod 에러', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^상품명$/), '저가 상품')
    await user.clear(screen.getByLabelText(/판매가/))
    await user.type(screen.getByLabelText(/판매가/), '50')
    await user.type(screen.getByLabelText(/내부 카테고리/), '가전')

    // 제출 시도 (disabled 일 수도 있으나, formState.errors 가 트리거되도록 한 번 클릭)
    const submit = screen.getByRole('button', { name: /다음: 이미지/ })
    // disabled 우회 — handleSubmit 호출은 trigger() 로 검증
    await user.click(submit)
    expect(await screen.findByText(/판매가는 100원 이상/)).toBeInTheDocument()
  })
})
