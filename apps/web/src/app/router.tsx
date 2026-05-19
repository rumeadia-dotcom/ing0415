import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { RegisterLayout } from './layouts/RegisterLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { NotFoundPage } from './NotFoundPage'
import { Skeleton } from '@/components/ui'

/**
 * MarketCast 라우터 — 단일 소스 (frontend.md §2.1).
 *
 * 구조:
 *  - `AuthLayout` 하위: /login /signup /forgot-password /reset-password (사이드바 없음)
 *  - `AppLayout` 하위: /dashboard /register /markets /history (사이드바 + 헤더)
 *    - /register 는 RegisterLayout 으로 한 번 더 중첩 (5단계 스테퍼)
 *  - `*` → NotFoundPage
 *
 * 모든 도메인 페이지는 lazy import — 루트 번들 슬림화 (frontend.md §2.1 / §12.1).
 * 인증 가드(`RequireAuth`) 는 Stage E 에서 도입. 현재는 모든 라우트가 무가드 접근 가능.
 *
 * `basename` 은 Vite `BASE_URL` 을 따른다 (`base: './'` 빌드 대비). 정적 호스팅 경로 미정이면
 * BASE_URL 은 `/` 이므로 기본 동작과 동일.
 */

// ── lazy 페이지 ────────────────────────────────────────────────────────────────
// auth
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const SignupPage = lazy(() => import('@/features/auth/pages/SignupPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
// dashboard
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
// registration
const RegisterIndexPage = lazy(
  () => import('@/features/registration/pages/RegisterIndexPage'),
)
const StepInfoPage = lazy(() => import('@/features/registration/pages/StepInfoPage'))
const StepImagesPage = lazy(() => import('@/features/registration/pages/StepImagesPage'))
const StepMarketsPage = lazy(() => import('@/features/registration/pages/StepMarketsPage'))
const StepCategoriesPage = lazy(
  () => import('@/features/registration/pages/StepCategoriesPage'),
)
const StepPreviewPage = lazy(() => import('@/features/registration/pages/StepPreviewPage'))
const StepResultPage = lazy(() => import('@/features/registration/pages/StepResultPage'))
// markets
const MarketsListPage = lazy(() => import('@/features/markets/pages/MarketsListPage'))
const MarketsConnectPage = lazy(() => import('@/features/markets/pages/MarketsConnectPage'))
const MarketsConnectProviderPage = lazy(
  () => import('@/features/markets/pages/MarketsConnectProviderPage'),
)
const OAuthCallbackPage = lazy(() => import('@/features/markets/pages/OAuthCallbackPage'))
// history
const HistoryListPage = lazy(() => import('@/features/history/pages/HistoryListPage'))
const HistoryDetailPage = lazy(() => import('@/features/history/pages/HistoryDetailPage'))

// ── Suspense 폴백 ──────────────────────────────────────────────────────────────
function PageFallback(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="페이지를 불러오는 중"
      className="space-y-3 p-6"
    >
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function withSuspense(node: JSX.Element): JSX.Element {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>
}

// ── 라우트 트리 ────────────────────────────────────────────────────────────────
const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'signup', element: withSuspense(<SignupPage />) },
      { path: 'forgot-password', element: withSuspense(<ForgotPasswordPage />) },
      { path: 'reset-password', element: withSuspense(<ResetPasswordPage />) },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'dashboard', element: withSuspense(<DashboardPage />) },
      {
        path: 'register',
        element: <RegisterLayout />,
        children: [
          { index: true, element: withSuspense(<RegisterIndexPage />) },
          { path: 'info', element: withSuspense(<StepInfoPage />) },
          { path: 'images', element: withSuspense(<StepImagesPage />) },
          { path: 'markets', element: withSuspense(<StepMarketsPage />) },
          { path: 'categories', element: withSuspense(<StepCategoriesPage />) },
          { path: 'preview', element: withSuspense(<StepPreviewPage />) },
        ],
      },
      // 결과 페이지는 위저드(RegisterLayout) 바깥
      { path: 'register/result/:jobId', element: withSuspense(<StepResultPage />) },
      {
        path: 'markets',
        children: [
          { index: true, element: withSuspense(<MarketsListPage />) },
          { path: 'connect', element: withSuspense(<MarketsConnectPage />) },
          {
            path: 'connect/:provider',
            element: withSuspense(<MarketsConnectProviderPage />),
          },
          { path: 'callback/:provider', element: withSuspense(<OAuthCallbackPage />) },
        ],
      },
      {
        path: 'history',
        children: [
          { index: true, element: withSuspense(<HistoryListPage />) },
          { path: ':jobId', element: withSuspense(<HistoryDetailPage />) },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
    errorElement: <RouteErrorBoundary />,
  },
]

export const router = createBrowserRouter(routes, {
  // Vite base 와 동기화. './' 빌드 시 BASE_URL 은 '/' 로 평가됨.
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})
