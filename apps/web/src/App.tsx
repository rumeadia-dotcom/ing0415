import { RouterProvider } from 'react-router-dom'
import { AppProviders } from './app/providers/AppProviders'
import { router } from './app/router'
import { Toaster } from '@/components/ui'

/**
 * App 진입점 — Stage D.
 *
 * - AppProviders: QueryClientProvider + TooltipProvider + (debug) Devtools
 * - RouterProvider: React Router v6 데이터 라우터 (router.tsx 단일 소스)
 * - Toaster: sonner 토스트. 인증 화면에서도 사용 가능하도록 root 위치.
 */
export function App(): JSX.Element {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <Toaster />
    </AppProviders>
  )
}
