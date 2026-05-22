import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'
import { ko } from '@/locales/ko'

/**
 * SettingsPoliciesPage 단위 테스트 — R-001 (성공 + 실패 시나리오).
 *
 * 검증:
 *  - 빈 상태: empty CTA + "새 정책 추가" 노출
 *  - 데이터 상태: 정책 row 가 모두 노출
 *  - 기본값 토글: update mutation 호출 + isDefault=true 로 전달
 *  - 실패 상태: ErrorMessage 노출
 */

const useShippingPoliciesMock = vi.fn()
const createMutateMock = vi.fn()
const updateMutateMock = vi.fn()
const deleteMutateMock = vi.fn()

vi.mock('@/features/registration/hooks/useShippingPolicies', () => ({
  useShippingPolicies: () => useShippingPoliciesMock(),
  useCreateShippingPolicy: () => ({ isPending: false, mutate: createMutateMock }),
  useUpdateShippingPolicy: () => ({ isPending: false, mutate: updateMutateMock }),
  useDeleteShippingPolicy: () => ({ isPending: false, mutate: deleteMutateMock }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { SettingsPoliciesPage } from '../pages/SettingsPoliciesPage'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/settings/policies']}>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
  render(<SettingsPoliciesPage />, { wrapper })
}

const samplePolicies = [
  {
    id: '00000000-0000-0000-0000-0000000000a1',
    name: '기본 택배',
    fee: 3000,
    method: 'parcel' as const,
    etaDays: 2,
    isDefault: true,
  },
  {
    id: '00000000-0000-0000-0000-0000000000a2',
    name: '당일 직배',
    fee: 0,
    method: 'direct' as const,
    etaDays: 1,
    isDefault: false,
  },
]

describe('SettingsPoliciesPage', () => {
  beforeEach(() => {
    useShippingPoliciesMock.mockReset()
    createMutateMock.mockReset()
    updateMutateMock.mockReset()
    deleteMutateMock.mockReset()
  })

  it('빈 상태: empty CTA + 새 정책 추가 버튼 노출', () => {
    useShippingPoliciesMock.mockReturnValue({
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [],
    })
    renderPage()

    expect(screen.getByText(ko.settings.policies.empty.title)).toBeInTheDocument()
    // 헤더 CTA + Empty 안의 CTA 둘 다 라벨 동일 → at least 1
    const ctas = screen.getAllByRole('button', { name: ko.settings.policies.addCta })
    expect(ctas.length).toBeGreaterThan(0)
  })

  it('데이터 상태: 정책 row 가 모두 노출된다', () => {
    useShippingPoliciesMock.mockReturnValue({
      isPending: false,
      isError: false,
      isSuccess: true,
      data: samplePolicies,
    })
    renderPage()

    expect(screen.getByText('기본 택배')).toBeInTheDocument()
    expect(screen.getByText('당일 직배')).toBeInTheDocument()
    // 기본값 배지
    expect(screen.getByText(ko.settings.policies.badge.isDefault)).toBeInTheDocument()
  })

  it('기본값 토글: 비기본 정책의 토글을 누르면 isDefault=true 로 update mutation 호출', async () => {
    useShippingPoliciesMock.mockReturnValue({
      isPending: false,
      isError: false,
      isSuccess: true,
      data: samplePolicies,
    })
    renderPage()

    const user = userEvent.setup()

    // 두 번째 row (직접배송, isDefault=false) 의 Switch 를 클릭
    const list = screen.getByTestId('policies-list')
    const items = within(list).getAllByRole('listitem')
    expect(items.length).toBe(2)
    const secondRow = items[1]
    if (!secondRow) throw new Error('expected 2 rows')
    const toggle = within(secondRow).getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    expect(updateMutateMock).toHaveBeenCalledTimes(1)
    const [input] = updateMutateMock.mock.calls[0] ?? []
    expect(input).toEqual(
      expect.objectContaining({
        id: '00000000-0000-0000-0000-0000000000a2',
        isDefault: true,
        name: '당일 직배',
        method: 'direct',
        fee: 0,
        etaDays: 1,
      }),
    )
  })

  it('실패 상태: ErrorMessage 가 노출된다', () => {
    useShippingPoliciesMock.mockReturnValue({
      isPending: false,
      isError: true,
      isSuccess: false,
      error: new Error('boom'),
      data: undefined,
    })
    renderPage()

    expect(
      screen.getByText(ko.settings.policies.errors.fetch),
    ).toBeInTheDocument()
  })
})
