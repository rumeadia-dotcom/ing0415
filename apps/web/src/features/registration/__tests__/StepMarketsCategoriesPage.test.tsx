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

vi.mock('@/features/markets/hooks/useMarketAccounts', () => ({
  useMarketAccounts: () => ({
    isLoading: false,
    isError: false,
    data: [
      {
        id: '00000000-0000-0000-0000-000000000aa1',
        marketId: 'naver',
        accountLabel: '메인',
        externalAccountId: null,
        status: 'active',
        connectedAt: '2026-05-20T00:00:00.000+09:00',
        lastVerifiedAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000aa5',
        marketId: '11st',
        accountLabel: '11번가 메인',
        externalAccountId: null,
        status: 'active',
        connectedAt: '2026-05-20T00:00:00.000+09:00',
        lastVerifiedAt: null,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ],
  }),
}))

vi.mock('../hooks/useMarketCategoryTree', () => ({
  useMarketCategoryTree: () => ({
    isLoading: false,
    isError: false,
    data: [
      { id: 'c-root', name: '가전', depth: 1, leaf: false, parentId: null, children: [
        { id: 'c-kitchen', name: '주방가전', depth: 2, leaf: true, parentId: 'c-root', children: [] },
      ] },
    ],
  }),
}))

import { StepMarketsCategoriesPage } from '../pages/StepMarketsCategoriesPage'
import { useRegisterFormStore } from '../store/useRegisterFormStore'

const PRODUCT_ID = '00000000-0000-0000-0000-0000000000c3'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/register/markets']}>
          <Routes>
            <Route path="/register/info" element={<div>step-info</div>} />
            <Route path="/register/images" element={<div>step-images</div>} />
            <Route path="/register/markets" element={children} />
            <Route path="/register/preview" element={<div>step-preview</div>} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<StepMarketsCategoriesPage />, { wrapper })
}

describe('StepMarketsCategoriesPage', () => {
  beforeEach(() => {
    useRegisterFormStore.getState().clear()
  })

  it('productId 없으면 /register/info 회귀', async () => {
    renderPage()
    await screen.findByText('step-info')
  })

  it('마켓 0개 선택: 다음 disabled', () => {
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    renderPage()
    expect(screen.getByRole('button', { name: /다음: 미리보기/ })).toBeDisabled()
  })

  it('네이버 선택 + 카테고리 매핑 → 다음 활성 → /register/preview', async () => {
    const user = userEvent.setup()
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    renderPage()

    await user.click(screen.getByRole('checkbox', { name: /네이버 스마트스토어 선택/ }))
    const categorySelect = await screen.findByLabelText(/네이버 스마트스토어 카테고리 선택/)
    await user.selectOptions(categorySelect, 'c-kitchen')

    const submit = screen.getByRole('button', { name: /다음: 미리보기/ })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    await screen.findByText('step-preview')
  })

  it('11번가도 active 계정이 있으면 선택 가능 (다른 4마켓과 동등)', async () => {
    const user = userEvent.setup()
    useRegisterFormStore.getState().setProductId(PRODUCT_ID)
    renderPage()
    const cb = screen.getByRole('checkbox', { name: /11번가 선택/ })
    // 더 이상 disabled 아님 — 선택 가능
    expect(cb).toBeEnabled()
    await user.click(cb)
    expect(cb).toBeChecked()
    // 선택 시 11번가 카테고리 매핑 카드가 노출됨
    expect(await screen.findByLabelText(/11번가 카테고리 선택/)).toBeInTheDocument()
  })
})
