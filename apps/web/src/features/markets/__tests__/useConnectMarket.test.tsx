import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// AuthContext mock — useAuth().user.id 만 필요
vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: { id: '00000000-0000-0000-0000-000000000001' } }),
}))

// markets-api mock — connectMarket 구현체만 모의
import type * as MarketsApiModule from '../api/markets-api'

const connectMarketMock = vi.fn()
vi.mock('../api/markets-api', async () => {
  const actual = await vi.importActual<typeof MarketsApiModule>('../api/markets-api')
  return {
    ...actual,
    connectMarket: (req: unknown) => connectMarketMock(req),
  }
})

import { useConnectMarket } from '../hooks/useConnectMarket'
import { MarketApiInvocationError } from '../api/markets-api'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useConnectMarket', () => {
  beforeEach(() => {
    connectMarketMock.mockReset()
  })

  it('성공 시 onSuccess data 반환', async () => {
    connectMarketMock.mockResolvedValueOnce({
      accountId: '00000000-0000-0000-0000-000000000999',
      market: 'coupang',
      accountLabel: '메인',
      status: 'active',
      connectedAt: '2026-05-20T00:00:00.000+09:00',
      correlationId: '11111111-1111-1111-1111-111111111111',
    })

    const { result } = renderHook(() => useConnectMarket(), { wrapper })

    act(() => {
      result.current.mutate({
        market: 'coupang',
        accountLabel: '메인',
        accessKey: 'a',
        secretKey: 'b',
        vendorId: 'V1',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.accountId).toBe('00000000-0000-0000-0000-000000000999')
    expect(connectMarketMock).toHaveBeenCalledTimes(1)
  })

  it('실패 시 MarketApiInvocationError 가 error 로 전달', async () => {
    connectMarketMock.mockRejectedValueOnce(
      new MarketApiInvocationError({
        code: 'duplicate_label',
        message: 'duplicate label',
        correlationId: '22222222-2222-2222-2222-222222222222',
      }),
    )

    const { result } = renderHook(() => useConnectMarket(), { wrapper })

    act(() => {
      result.current.mutate({
        market: 'coupang',
        accountLabel: '메인',
        accessKey: 'a',
        secretKey: 'b',
        vendorId: 'V1',
      })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(MarketApiInvocationError)
    expect((result.current.error as MarketApiInvocationError).code).toBe('duplicate_label')
  })
})
