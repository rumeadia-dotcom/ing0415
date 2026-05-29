/**
 * useMock=true 환경에서 registration flow 통합 테스트.
 *
 * 단위 테스트는 `registrationValidate` 자체를 mock 하므로 supabase client
 * chain 을 우회한다. 본 테스트는 mock supabase invoke 분기 → invokeEdge
 * → schema parse → useMutation state update 까지 end-to-end 가 settle
 * 하는지를 jsdom 환경에서 검증한다.
 */
import { vi, describe, it, expect } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    VITE_APP_MODE: 'dev' as const,
    VITE_USE_MOCK: true,
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
  },
  useMock: true,
  isDev: true,
  isReal: false,
}))

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ReactNode } from 'react'
import { useRegistrationValidate } from '../hooks/useRegistrationValidate'
import { useRegistrationStart } from '../hooks/useRegistrationStart'

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  })
  // 실 브라우저와 동일하게 StrictMode 래핑 — main.tsx:22 정합
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </StrictMode>
    )
  }
  return Wrapper
}

describe('mock 통합 — registration mutation chain', () => {
  it('registration-validate: mutate → success + previews 5', async () => {
    const { result } = renderHook(() => useRegistrationValidate(), {
      wrapper: makeWrapper(),
    })

    expect(result.current.status).toBe('idle')

    result.current.mutate({
      productId: '00000000-0000-0000-0000-000000000aaa',
      marketIds: ['naver', 'coupang', '11st', 'gmarket', 'auction'],
    })

    await waitFor(
      () => {
        expect(result.current.isPending).toBe(false)
      },
      { timeout: 1000 },
    )

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data?.ok).toBe(true)
    expect(result.current.data?.previews).toHaveLength(5)
    expect(result.current.data?.issues).toEqual([])
  })

  it('StepPreviewPage + StrictMode + mock supabase — 마켓 카드 5개 + "일괄 등록 실행" enabled', async () => {
    const { StepPreviewPage } = await import('../pages/StepPreviewPage')
    const { useRegisterFormStore } = await import('../store/useRegisterFormStore')
    const { TooltipProvider } = await import('@/components/ui/tooltip')
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { render, screen, waitFor } = await import('@testing-library/react')

    useRegisterFormStore.getState().clear()
    useRegisterFormStore.getState().setProductId('00000000-0000-0000-0000-000000000ccc')
    useRegisterFormStore.getState().setSelections([
      { marketId: 'naver', marketAccountId: '00000000-0000-0000-0000-0000000000a1' },
      { marketId: 'coupang', marketAccountId: '00000000-0000-0000-0000-0000000000a2' },
      { marketId: '11st', marketAccountId: '00000000-0000-0000-0000-0000000000a3' },
      { marketId: 'gmarket', marketAccountId: '00000000-0000-0000-0000-0000000000a4' },
      { marketId: 'auction', marketAccountId: '00000000-0000-0000-0000-0000000000a5' },
    ])

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
    })
    render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/register/preview']}>
              <Routes>
                <Route path="/register/preview" element={<StepPreviewPage />} />
                <Route path="/register/info" element={<div>step-info</div>} />
                <Route path="/register/markets" element={<div>step-markets</div>} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </StrictMode>,
    )

    await waitFor(
      () => {
        // 매 render 마다 새로 query — stale DOM reference 회피
        const submit = screen.getByRole('button', { name: /일괄 등록 실행/ })
        expect(submit).toBeEnabled()
      },
      { timeout: 2000 },
    )
  })

  it('step 5 chain: registration-start → fetchJobWithResults → succeeded job + 5 marketResults', async () => {
    const { registrationStart, fetchJobWithResults } = await import('../api/registration-api')
    const startRes = await registrationStart({
      productId: '00000000-0000-0000-0000-000000000fff',
      marketIds: ['naver', 'coupang', '11st', 'gmarket', 'auction'],
    })
    expect(startRes.jobId).toMatch(/^[0-9a-f-]{36}$/)

    const { job, results } = await fetchJobWithResults(startRes.jobId)
    expect(job.id).toBe(startRes.jobId)
    expect(job.status).toBe('succeeded')
    expect(results).toHaveLength(5)
    expect(results[0]?.marketStatus).toBe('success')
    expect(results[0]?.externalProductId).toMatch(/^MOCK-/)
  })

  it('registration-start: mutate → success + jobId + marketResults', async () => {
    const { result } = renderHook(() => useRegistrationStart(), {
      wrapper: makeWrapper(),
    })

    result.current.mutate({
      productId: '00000000-0000-0000-0000-000000000bbb',
      marketIds: ['naver', 'coupang'],
    })

    await waitFor(
      () => {
        expect(result.current.isPending).toBe(false)
      },
      { timeout: 1000 },
    )

    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data?.status).toBe('pending')
    expect(result.current.data?.marketResults).toHaveLength(2)
    expect(result.current.data?.jobId).toMatch(/^[0-9a-f-]{36}$/)
  })
})
