import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query'
import type { HistoryListPage as HistoryListPageType } from '../api/history-api'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

const mockList =
  vi.fn<[], Partial<UseInfiniteQueryResult<InfiniteData<HistoryListPageType>, Error>>>()
vi.mock('../hooks/useHistoryList', () => ({
  useHistoryList: () => mockList(),
}))

import { HistoryListPage } from '../pages/HistoryListPage'

function renderPage(initialEntries: string[] = ['/history']): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<HistoryListPage />, { wrapper })
}

function makePage(items: HistoryListPageType['items'], total = 0): InfiniteData<HistoryListPageType> {
  return {
    pages: [{ items, totalCount: total, nextCursor: null }],
    pageParams: [null],
  }
}

describe('HistoryListPage 4상태', () => {
  it('loading: 스켈레톤 노출 (목록/empty 없음)', () => {
    mockList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('status', { name: '목록 불러오는 중' })).toBeInTheDocument()
  })

  it('empty (filter 디폴트, 등록 0건): isAbsoluteEmpty true → "첫 상품 등록 시작" CTA', () => {
    mockList.mockReturnValue({
      data: makePage([], 0),
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage(['/history'])
    expect(screen.getByText('아직 등록 이력이 없어요')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '첫 상품 등록 시작' }),
    ).toBeInTheDocument()
  })

  it('empty (filter 적용 결과 0건): "필터 초기화" 버튼만', () => {
    mockList.mockReturnValue({
      data: makePage([], 0),
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage(['/history?period=7d&market=naver'])
    expect(screen.queryByText('아직 등록 이력이 없어요')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '필터 초기화' }),
    ).toBeInTheDocument()
  })

  it('data: 잡 row 1개 노출 + 총 건수 헤더', () => {
    mockList.mockReturnValue({
      data: makePage(
        [
          {
            id: '22222222-2222-2222-2222-222222222222',
            status: 'partial',
            createdAt: '2026-05-19T10:00:00Z',
            startedAt: '2026-05-19T10:00:01Z',
            completedAt: '2026-05-19T10:00:30Z',
            retryCount: 0,
            errorSummary: null,
            parentJobId: null,
            productId: '33333333-3333-3333-3333-333333333333',
            productName: '여름 원피스 A',
            productThumbnailId: null,
            marketSummary: [
              { marketId: 'naver', marketStatus: 'success', excluded: false },
              { marketId: 'coupang', marketStatus: 'failed', excluded: false },
            ],
          },
        ],
        12,
      ),
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByText(/총 12건/)).toBeInTheDocument()
    // 데스크탑 row + 모바일 카드 둘 다 렌더되어 productName 이 2번 (테이블/카드)
    expect(screen.getAllByText('여름 원피스 A').length).toBeGreaterThanOrEqual(1)
  })

  it('error: error 메시지 alert 노출', () => {
    mockList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network down'),
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('network down')
  })
})
