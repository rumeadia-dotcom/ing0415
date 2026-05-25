import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui'
import { isDev } from '@/lib/env'
import { createQueryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/features/auth'

/**
 * 글로벌 Provider 묶음.
 *
 * 구성:
 *  - QueryClientProvider: TanStack Query 단일 클라이언트 (StrictMode 이중 마운트 대비 useState 초기자)
 *  - TooltipProvider: shadcn tooltip 전역 (delayDuration 150ms)
 *  - ReactQueryDevtools: dev 모드 전용. cycle 42: dynamic import 로 변경 — real 빌드에서
 *    devtools 청크가 분리되어 절대 로드되지 않음 (이전엔 정적 import 라 ~60KB 잔여물).
 */

// dynamic import — isDev 가 런타임 변수라 빌드 타임 tree-shake 불가.
// lazy() 가 chunk 분리를 강제 — real 빌드에서 devtools 가 별도 파일로 떨어져 절대 fetch 안 됨.
const ReactQueryDevtoolsLazy = lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({
    default: m.ReactQueryDevtools,
  })),
)

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </AuthProvider>
      {isDev && (
        <Suspense fallback={null}>
          <ReactQueryDevtoolsLazy initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  )
}
