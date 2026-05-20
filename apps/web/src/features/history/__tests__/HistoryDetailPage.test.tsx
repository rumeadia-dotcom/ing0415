import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { JobDetail } from '@/lib/schemas/history-filter'
import type * as ReactRouterDom from 'react-router-dom'

// ─────────────────────────────────────────────
// mocks
// ─────────────────────────────────────────────
const mockDetail = vi.fn<[], Partial<UseQueryResult<JobDetail | null, Error>>>()
vi.mock('../hooks/useHistoryDetail', () => ({
  useHistoryDetail: (jobId: string | null | undefined) => {
    void jobId
    return mockDetail()
  },
}))

const retryMutate = vi.fn()
const startMutate = vi.fn()
const navigateSpy = vi.fn()

vi.mock('@/features/registration/hooks/useRegistrationRetry', () => ({
  useRegistrationRetry: () => ({ mutate: retryMutate, isPending: false }),
}))
vi.mock('@/features/registration/hooks/useRegistrationStart', () => ({
  useRegistrationStart: () => ({ mutate: startMutate, isPending: false }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  }
})

import { HistoryDetailPage } from '../pages/HistoryDetailPage'

// ─────────────────────────────────────────────
// fixtures
// ─────────────────────────────────────────────
const JOB_ID = '00000000-0000-0000-0000-000000000001'
const PRODUCT_ID = '00000000-0000-0000-0000-0000000000aa'

function makeDetail(
  overrides: Partial<JobDetail> = {},
  jobOverrides: Partial<JobDetail['job']> = {},
): JobDetail {
  return {
    job: {
      id: JOB_ID,
      sellerId: '00000000-0000-0000-0000-0000000000bb',
      productId: PRODUCT_ID,
      status: 'partial',
      createdAt: new Date('2026-05-19T10:00:00Z').toISOString(),
      startedAt: new Date('2026-05-19T10:00:05Z').toISOString(),
      completedAt: new Date('2026-05-19T10:01:00Z').toISOString(),
      retryCount: 0,
      errorSummary: null,
      cancelledAt: null,
      parentJobId: null,
      correlationId: '00000000-0000-0000-0000-0000000000cc',
      ...jobOverrides,
    },
    cancelledByMaskedId: null,
    product: {
      id: PRODUCT_ID,
      name: '테스트 상품',
      thumbnailImageId: null,
    },
    parent: null,
    children: [],
    marketResults: [
      {
        id: '00000000-0000-0000-0000-000000001001',
        marketId: 'naver',
        marketStatus: 'success',
        externalProductId: 'NV-123',
        productUrl: 'https://smartstore.naver.com/x/123',
        errorCode: null,
        errorMessage: null,
        attemptCount: 1,
        lastAttemptedAt: new Date('2026-05-19T10:00:30Z').toISOString(),
        excluded: false,
        updatedAt: new Date('2026-05-19T10:00:30Z').toISOString(),
      },
      {
        id: '00000000-0000-0000-0000-000000001002',
        marketId: 'coupang',
        marketStatus: 'failed',
        externalProductId: null,
        productUrl: null,
        errorCode: 'E_CATEGORY_MISMATCH',
        errorMessage: '카테고리 매핑 누락',
        attemptCount: 1,
        lastAttemptedAt: new Date('2026-05-19T10:00:45Z').toISOString(),
        excluded: false,
        updatedAt: new Date('2026-05-19T10:00:45Z').toISOString(),
      },
    ],
    ...overrides,
  }
}

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/history/${JOB_ID}`]}>
        <Routes>
          <Route path="/history/:jobId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  render(<HistoryDetailPage />, { wrapper })
}

beforeEach(() => {
  retryMutate.mockReset()
  startMutate.mockReset()
  navigateSpy.mockReset()
})

// ─────────────────────────────────────────────
// 1. 재시도 Dialog flow
// ─────────────────────────────────────────────
describe('HistoryDetailPage - retry dialog', () => {
  it('partial 잡: 재시도 버튼 노출 → 다이얼로그 열고 confirm 시 retry.mutate 호출', () => {
    mockDetail.mockReturnValue({
      data: makeDetail(),
      isLoading: false,
      isError: false,
    })
    renderPage()

    const retryBtn = screen.getByRole('button', { name: '재시도' })
    expect(retryBtn).not.toBeDisabled()
    fireEvent.click(retryBtn)

    expect(
      screen.getByRole('heading', { name: '실패한 마켓 재시도' }),
    ).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: '재시도 시작' })
    fireEvent.click(confirmBtn)

    expect(retryMutate).toHaveBeenCalledTimes(1)
    const call = retryMutate.mock.calls[0]?.[0] as {
      jobId: string
      marketResultIds: string[]
    }
    expect(call.jobId).toBe(JOB_ID)
    // 재시도 대상 = failed 만 (success 인 naver 제외)
    expect(call.marketResultIds).toEqual([
      '00000000-0000-0000-0000-000000001002',
    ])
  })
})

// ─────────────────────────────────────────────
// 2. 제외 후 재등록 validate (1개 이상 선택 강제)
// ─────────────────────────────────────────────
describe('HistoryDetailPage - exclude dialog', () => {
  it('체크박스 모두 해제 시 재등록 버튼 disabled', () => {
    mockDetail.mockReturnValue({
      data: makeDetail(),
      isLoading: false,
      isError: false,
    })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '실패 마켓만 재등록' }))

    // failed 대상 coupang 만 노출
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox).toBeChecked()

    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()

    const submit = screen.getByRole('button', { name: '재등록 시작' })
    expect(submit).toBeDisabled()
    expect(startMutate).not.toHaveBeenCalled()
  })

  it('체크 유지하고 confirm 시 parentJobId + 선택한 marketIds 로 registration-start 호출', () => {
    mockDetail.mockReturnValue({
      data: makeDetail(),
      isLoading: false,
      isError: false,
    })
    // mutate 가 onSuccess 콜백을 직접 호출하도록 모킹
    startMutate.mockImplementation((_req, opts: { onSuccess?: (r: { jobId: string }) => void }) => {
      opts.onSuccess?.({ jobId: '00000000-0000-0000-0000-000000999999' })
    })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '실패 마켓만 재등록' }))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '재등록 시작' }))
    })

    expect(startMutate).toHaveBeenCalledTimes(1)
    const call = startMutate.mock.calls[0]?.[0] as {
      productId: string
      marketIds: string[]
      parentJobId?: string
    }
    expect(call.productId).toBe(PRODUCT_ID)
    expect(call.parentJobId).toBe(JOB_ID)
    expect(call.marketIds).toEqual(['coupang'])
    expect(navigateSpy).toHaveBeenCalledWith(
      '/history/00000000-0000-0000-0000-000000999999',
    )
  })
})

// ─────────────────────────────────────────────
// 3. partial 분기 (잡 상태별 액션 활성/비활성)
// ─────────────────────────────────────────────
describe('HistoryDetailPage - status-driven actions', () => {
  it('succeeded 잡: 재시도/재등록 모두 disabled', () => {
    mockDetail.mockReturnValue({
      data: makeDetail({}, { status: 'succeeded' }),
      isLoading: false,
      isError: false,
    })
    renderPage()

    expect(screen.getByRole('button', { name: '재시도' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '실패 마켓만 재등록' }),
    ).toBeDisabled()
  })
})
