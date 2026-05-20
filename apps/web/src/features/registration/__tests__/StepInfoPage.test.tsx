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
    data: [
      { id: '00000000-0000-0000-0000-0000000000a1', name: '기본 배송', fee: 3000, method: 'parcel', etaDays: 2, isDefault: true },
    ],
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
    await user.selectOptions(screen.getByLabelText(/배송 정책/), '00000000-0000-0000-0000-0000000000a1')

    // 제출 활성 후 클릭
    const submit = await screen.findByRole('button', { name: /다음: 이미지/ })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    await screen.findByText('step-images')
    const stored = useRegisterFormStore.getState().step1
    expect(stored?.name).toBe('테스트 텀블러')
    expect(stored?.price).toBe(15000)
    expect(stored?.shippingPolicyId).toBe('00000000-0000-0000-0000-0000000000a1')
  })

  it('판매가가 100 미만이면 zod 에러', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/^상품명$/), '저가 상품')
    await user.clear(screen.getByLabelText(/판매가/))
    await user.type(screen.getByLabelText(/판매가/), '50')
    await user.type(screen.getByLabelText(/내부 카테고리/), '가전')
    await user.selectOptions(screen.getByLabelText(/배송 정책/), '00000000-0000-0000-0000-0000000000a1')

    // 제출 시도 (disabled 일 수도 있으나, formState.errors 가 트리거되도록 한 번 클릭)
    const submit = screen.getByRole('button', { name: /다음: 이미지/ })
    // disabled 우회 — handleSubmit 호출은 trigger() 로 검증
    await user.click(submit)
    expect(await screen.findByText(/판매가는 100원 이상/)).toBeInTheDocument()
  })
})
