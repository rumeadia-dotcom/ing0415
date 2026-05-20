import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type {
  DashboardSummary,
  RecentJob,
  MarketHealth,
} from '@/lib/schemas/dashboard-summary'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

const mockSummary = vi.fn<[], Partial<UseQueryResult<DashboardSummary | null, unknown>>>()
const mockRecent = vi.fn<[], Partial<UseQueryResult<RecentJob[], unknown>>>()
const mockHealth = vi.fn<[], Partial<UseQueryResult<MarketHealth, unknown>>>()

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => mockSummary(),
}))
vi.mock('../hooks/useRecentJobs', () => ({
  useRecentJobs: () => mockRecent(),
}))
vi.mock('../hooks/useMarketHealth', () => ({
  useMarketHealth: () => mockHealth(),
}))

import { DashboardPage } from '../pages/DashboardPage'

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  render(<DashboardPage />, { wrapper })
}

const SUMMARY_OK: DashboardSummary = {
  seller_id: '11111111-1111-1111-1111-111111111111',
  jobs_today_count: 3,
  jobs_in_progress_count: 1,
  jobs_24h_count: 8,
  jobs_24h_succeeded: 6,
  jobs_24h_partial: 1,
  jobs_24h_failed: 1,
  jobs_7d_count: 20,
  jobs_7d_succeeded: 18,
  jobs_7d_partial: 1,
  jobs_7d_failed: 1,
  jobs_30d_count: 60,
  avg_duration_sec_7d: 42,
  last_job_at: '2026-05-19T10:00:00+09:00',
}

const HEALTH_OK: MarketHealth = { active: 3, expired: 1, revoked: 0, error: 0, total: 4 }

describe('DashboardPage', () => {
  it('loading: 4개 SummaryCard 가 모두 로딩 상태로 렌더', () => {
    mockSummary.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    mockRecent.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    mockHealth.mockReturnValue({ isLoading: true, isError: false, data: undefined })

    renderPage()

    expect(screen.getByText('오늘 등록')).toBeInTheDocument()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByText('7일 성공률')).toBeInTheDocument()
    expect(screen.getByText('평균 소요 (7일)')).toBeInTheDocument()
  })

  it('data: 7일 성공률을 18/20 → 90% 로 계산 표시', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: false, data: SUMMARY_OK })
    mockRecent.mockReturnValue({ isLoading: false, isError: false, data: [] })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('18/20건')).toBeInTheDocument()
    expect(screen.getByText('3건')).toBeInTheDocument() // jobs_today_count
  })

  it('empty (last_job_at=null): EmptyState 가 렌더되고 최근잡 영역은 미표시', () => {
    mockSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...SUMMARY_OK, last_job_at: null, jobs_today_count: 0, jobs_7d_count: 0 },
    })
    mockRecent.mockReturnValue({ isLoading: false, isError: false, data: [] })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getByText('첫 상품을 등록해 보세요')).toBeInTheDocument()
    expect(screen.queryByText('최근 등록')).not.toBeInTheDocument()
  })

  it('marketHealth 경고: expired 가 1 이상이면 재연결 안내 노출', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: false, data: SUMMARY_OK })
    mockRecent.mockReturnValue({ isLoading: false, isError: false, data: [] })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getByText(/토큰이 만료된 마켓이 1개/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /마켓 페이지에서 재연결/ })).toBeInTheDocument()
  })

  it('error: summary 실패 시 SummaryCard 4개 모두 "불러오기 실패" 표시', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    mockRecent.mockReturnValue({ isLoading: false, isError: false, data: [] })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getAllByText('불러오기 실패')).toHaveLength(4)
  })
})
