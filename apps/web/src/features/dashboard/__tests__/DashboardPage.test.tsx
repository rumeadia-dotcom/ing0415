import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type {
  DashboardSummary,
  MarketHealth,
  MarketOrdersSummary,
} from '@/lib/schemas/dashboard-summary'

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: 'seller-1' } }),
}))

const mockSummary = vi.fn<[], Partial<UseQueryResult<DashboardSummary | null, unknown>>>()
const mockMarketOrders = vi.fn<[], Partial<UseQueryResult<MarketOrdersSummary, unknown>>>()
const mockHealth = vi.fn<[], Partial<UseQueryResult<MarketHealth, unknown>>>()

vi.mock('../hooks/useDashboardSummary', () => ({
  useDashboardSummary: () => mockSummary(),
}))
vi.mock('../hooks/useMarketOrdersSummary', () => ({
  useMarketOrdersSummary: () => mockMarketOrders(),
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
const HEALTH_EMPTY: MarketHealth = { active: 0, expired: 0, revoked: 0, error: 0, total: 0 }

const MARKET_ORDERS_OK: MarketOrdersSummary = {
  markets: [
    {
      marketId: 'naver',
      connected: true,
      newOrdersCount: 5,
      todayTotalCount: 12,
      lastSyncedAt: '2026-05-21T09:00:00+09:00',
      syncStatus: 'idle',
      syncError: null,
    },
    {
      marketId: 'coupang',
      connected: true,
      newOrdersCount: 0,
      todayTotalCount: 3,
      lastSyncedAt: '2026-05-21T08:30:00+09:00',
      syncStatus: 'idle',
      syncError: null,
    },
    {
      marketId: 'gmarket',
      connected: true,
      newOrdersCount: 2,
      todayTotalCount: 4,
      lastSyncedAt: '2026-05-21T07:00:00+09:00',
      syncStatus: 'idle',
      syncError: null,
    },
    {
      marketId: 'auction',
      connected: true,
      newOrdersCount: 0,
      todayTotalCount: 0,
      lastSyncedAt: null,
      syncStatus: 'error',
      syncError: 'TOKEN_EXPIRED',
    },
  ],
  comingSoon: ['11st'],
}

// 일부 마켓만 연동된 상태 — naver 연동(주문 있음), gmarket 미연동.
const MARKET_ORDERS_MIXED: MarketOrdersSummary = {
  markets: [
    {
      marketId: 'naver',
      connected: true,
      newOrdersCount: 5,
      todayTotalCount: 12,
      lastSyncedAt: '2026-05-21T09:00:00+09:00',
      syncStatus: 'idle',
      syncError: null,
    },
    {
      marketId: 'gmarket',
      connected: false,
      newOrdersCount: 0,
      todayTotalCount: 0,
      lastSyncedAt: null,
      syncStatus: 'idle',
      syncError: null,
    },
  ],
  comingSoon: [],
}

const MARKET_ORDERS_EMPTY: MarketOrdersSummary = {
  markets: [
    { marketId: 'naver', connected: false, newOrdersCount: 0, todayTotalCount: 0, lastSyncedAt: null, syncStatus: 'idle', syncError: null },
    { marketId: 'coupang', connected: false, newOrdersCount: 0, todayTotalCount: 0, lastSyncedAt: null, syncStatus: 'idle', syncError: null },
    { marketId: 'gmarket', connected: false, newOrdersCount: 0, todayTotalCount: 0, lastSyncedAt: null, syncStatus: 'idle', syncError: null },
    { marketId: 'auction', connected: false, newOrdersCount: 0, todayTotalCount: 0, lastSyncedAt: null, syncStatus: 'idle', syncError: null },
  ],
  comingSoon: ['11st'],
}

describe('DashboardPage', () => {
  it('loading: 4개 SummaryCard 가 모두 로딩 상태로 렌더', () => {
    mockSummary.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    mockMarketOrders.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    mockHealth.mockReturnValue({ isLoading: true, isError: false, data: undefined })

    renderPage()

    expect(screen.getByText('오늘 등록')).toBeInTheDocument()
    expect(screen.getByText('진행 중')).toBeInTheDocument()
    expect(screen.getByText('7일 성공률')).toBeInTheDocument()
    expect(screen.getByText('평균 소요 (7일)')).toBeInTheDocument()
  })

  it('data: 7일 성공률을 18/20 → 90% 로 계산 표시 + 마켓별 주문 위젯 렌더', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: false, data: SUMMARY_OK })
    mockMarketOrders.mockReturnValue({ isLoading: false, isError: false, data: MARKET_ORDERS_OK })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('18/20건')).toBeInTheDocument()
    expect(screen.getByText('3건')).toBeInTheDocument()
    expect(screen.getByText('마켓별 주문 현황')).toBeInTheDocument()
    // 네이버 신규 5
    expect(screen.getByText('네이버 스마트스토어')).toBeInTheDocument()
    // 옥션은 syncStatus error → /markets 로 이동하는 카드 링크
    expect(
      screen.getByRole('link', { name: /옥션 연결 오류, 재인증 페이지로 이동/ }),
    ).toBeInTheDocument()
  })

  it('미연동 마켓은 비활성 행(미연동 배지 + 연결하기 링크)으로 렌더되고 주문 목록 이동 링크가 없다', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: false, data: SUMMARY_OK })
    mockMarketOrders.mockReturnValue({ isLoading: false, isError: false, data: MARKET_ORDERS_MIXED })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    // 연동된 naver 는 주문 목록으로 이동하는 카드 링크
    expect(
      screen.getByRole('link', { name: /네이버 스마트스토어 신규 5건/ }),
    ).toBeInTheDocument()

    // 미연동 gmarket 은 비활성 행 — 미연동 배지 + /markets 연결 유도, 주문 목록 링크 없음
    expect(screen.getByText('미연동')).toBeInTheDocument()
    const connectLink = screen.getByRole('link', { name: /G마켓 연결하기/ })
    expect(connectLink).toHaveAttribute('href', '/markets')
    expect(
      screen.queryByRole('link', { name: /G마켓 신규/ }),
    ).not.toBeInTheDocument()
  })

  it('empty no-markets: 연결 마켓 0건 → onboarding hero (2-step checklist)', () => {
    mockSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...SUMMARY_OK, last_job_at: null },
    })
    mockMarketOrders.mockReturnValue({ isLoading: false, isError: false, data: MARKET_ORDERS_EMPTY })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_EMPTY })

    renderPage()

    // Studio onboarding hero — gradient + 2-step checklist
    expect(screen.getByText(/첫 상품을 등록하면/)).toBeInTheDocument()
    expect(screen.getByText('마켓 연결')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /마켓 연결하기/ })).toBeInTheDocument()
    expect(screen.queryByText('마켓별 주문 현황')).not.toBeInTheDocument()
  })

  it('empty no-activity: 마켓 ≥1 + 잡 0 + 주문 0 → "첫 상품을 등록해 보세요" hero', () => {
    mockSummary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...SUMMARY_OK, last_job_at: null, jobs_today_count: 0, jobs_7d_count: 0 },
    })
    mockMarketOrders.mockReturnValue({ isLoading: false, isError: false, data: MARKET_ORDERS_EMPTY })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getByText('첫 상품을 등록해 보세요')).toBeInTheDocument()
  })

  it('marketHealth 경고: expired 가 1 이상이면 재연결 안내 노출', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: false, data: SUMMARY_OK })
    mockMarketOrders.mockReturnValue({ isLoading: false, isError: false, data: MARKET_ORDERS_OK })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getByText(/토큰이 만료된 마켓이 1개/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /마켓 페이지에서 재연결/ })).toBeInTheDocument()
  })

  it('error: summary 실패 시 SummaryCard 4개 모두 "불러오기 실패" 표시', () => {
    mockSummary.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    mockMarketOrders.mockReturnValue({ isLoading: false, isError: false, data: MARKET_ORDERS_OK })
    mockHealth.mockReturnValue({ isLoading: false, isError: false, data: HEALTH_OK })

    renderPage()

    expect(screen.getAllByText('불러오기 실패')).toHaveLength(4)
  })
})
