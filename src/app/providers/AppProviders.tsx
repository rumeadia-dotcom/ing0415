import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'
import { isDebug } from '@/lib/env'
import { createQueryClient } from '@/lib/queryClient'

/**
 * 글로벌 Provider 묶음.
 *
 * 구성:
 *  - QueryClientProvider: TanStack Query 단일 클라이언트 (StrictMode 이중 마운트 대비 useState 초기자)
 *  - TooltipProvider: shadcn tooltip 전역 (delayDuration 150ms)
 *  - ReactQueryDevtools: debug 모드 전용. real 빌드에서 정적 import 잔여물 있더라도
 *    devtools 가 isDebug=false 시 렌더하지 않으므로 사용자 노출 0. tree-shaking 까지
 *    원하면 Stage F 에서 dynamic import 로 전환.
 */
export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      {isDebug && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
