import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { resolveBasename } from '@/lib/url'
import { AppLayout } from './layouts/AppLayout'
import { AuthLayout } from './layouts/AuthLayout'
import { RegisterLayout } from './layouts/RegisterLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { NotFoundPage } from './NotFoundPage'
import { Footer } from '@/components/layout/Footer'
import { Skeleton } from '@/components/ui'
import { RequireAuth } from '@/features/auth'

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
 * 인증 가드 `RequireAuth` 는 AppLayout 그룹에 적용 — anonymous 면 /login 으로 리다이렉트,
 * loading 동안엔 skeleton. AuthLayout 그룹(/login 등)은 가드 없음.
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
const StepMarketsCategoriesPage = lazy(
  () => import('@/features/registration/pages/StepMarketsCategoriesPage'),
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
// settings
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'))
// v2 — orders (s7)
const OrdersDashboardPage = lazy(
  () => import('@/features/orders/pages/OrdersDashboardPage'),
)
const OrdersListPage = lazy(() => import('@/features/orders/pages/OrdersListPage'))
const OrderDetailPage = lazy(() => import('@/features/orders/pages/OrderDetailPage'))
// v2 — shipping (s8)
const ShippingPrintPage = lazy(
  () => import('@/features/shipping/pages/ShippingPrintPage'),
)
const ShippingDispatchPage = lazy(
  () => import('@/features/shipping/pages/ShippingDispatchPage'),
)
const ShippingDispatchResultPage = lazy(
  () => import('@/features/shipping/pages/ShippingDispatchResultPage'),
)
const ShippingHistoryPage = lazy(
  () => import('@/features/shipping/pages/ShippingHistoryPage'),
)
// v2 — settings/shipping (s9)
const SettingsShippingPage = lazy(
  () => import('@/features/settings/shipping/pages/SettingsShippingPage'),
)
const SettingsShippingLogenPage = lazy(
  () => import('@/features/settings/shipping/pages/SettingsShippingLogenPage'),
)
const SettingsShippingSenderPage = lazy(
  () => import('@/features/settings/shipping/pages/SettingsShippingSenderPage'),
)
const SettingsShippingEsmProfilesPage = lazy(
  () =>
    import('@/features/settings/shipping/pages/SettingsShippingEsmProfilesPage'),
)
const SettingsPoliciesPage = lazy(
  () => import('@/features/settings/policies/pages/SettingsPoliciesPage'),
)
// legal (비인증 접근 가능)
const TermsPage = lazy(() => import('@/features/legal/pages/TermsPage'))
const PrivacyPage = lazy(() => import('@/features/legal/pages/PrivacyPage'))
const ManualPage = lazy(() => import('@/features/legal/pages/ManualPage'))

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

/**
 * PublicLegalShell — `/legal/*`, `/manual` 진입용 비인증 셸.
 * 사이드바·헤더 없이 본문 + 푸터만. 비로그인 사용자(예비 셀러)도 약관·매뉴얼을
 * 자유롭게 열람할 수 있어야 회원가입 단계에서 동의 의미가 성립.
 */
function PublicLegalShell(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle">
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
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
    // 비인증 접근 가능한 정적 페이지 (D-C: 약관 / 개인정보처리방침 / 매뉴얼)
    path: '/',
    element: <PublicLegalShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: 'legal/terms', element: withSuspense(<TermsPage />) },
      { path: 'legal/privacy', element: withSuspense(<PrivacyPage />) },
      { path: 'manual', element: withSuspense(<ManualPage />) },
    ],
  },
  {
    path: '/',
    element: <RequireAuth />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: 'dashboard', element: withSuspense(<DashboardPage />) },
          {
            path: 'register',
            element: <RegisterLayout />,
            children: [
              { index: true, element: withSuspense(<RegisterIndexPage />) },
              { path: 'info', element: withSuspense(<StepInfoPage />) },
              { path: 'images', element: withSuspense(<StepImagesPage />) },
              { path: 'markets', element: withSuspense(<StepMarketsCategoriesPage />) },
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
              {
                path: 'callback/:provider',
                element: withSuspense(<OAuthCallbackPage />),
              },
            ],
          },
          {
            path: 'history',
            children: [
              { index: true, element: withSuspense(<HistoryListPage />) },
              { path: ':jobId', element: withSuspense(<HistoryDetailPage />) },
            ],
          },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
          { path: 'settings/policies', element: withSuspense(<SettingsPoliciesPage />) },
          // v2 — 주문 현황 (s7 n47~n50). 마켓 미연동 시 페이지 안에서 미등록 안내.
          {
            path: 'orders',
            children: [
              { index: true, element: withSuspense(<OrdersDashboardPage />) },
              { path: 'list', element: withSuspense(<OrdersListPage />) },
              { path: ':orderId', element: withSuspense(<OrderDetailPage />) },
            ],
          },
          // v2 — 배송 처리 (s8 n52~n57). 마켓·로젠 미연동 시 페이지 안에서 미등록 안내.
          {
            path: 'shipping',
            children: [
              { path: 'print', element: withSuspense(<ShippingPrintPage />) },
              { path: 'dispatch', element: withSuspense(<ShippingDispatchPage />) },
              {
                path: 'dispatch/:jobId/result',
                element: withSuspense(<ShippingDispatchResultPage />),
              },
              { path: 'history', element: withSuspense(<ShippingHistoryPage />) },
            ],
          },
          // v2 — 배송 설정 (s9 n58~n60). /settings/shipping 는 별도 트리.
          {
            path: 'settings/shipping',
            children: [
              { index: true, element: withSuspense(<SettingsShippingPage />) },
              { path: 'logen', element: withSuspense(<SettingsShippingLogenPage />) },
              { path: 'sender', element: withSuspense(<SettingsShippingSenderPage />) },
              {
                path: 'esm-profiles',
                element: withSuspense(<SettingsShippingEsmProfilesPage />),
              },
            ],
          },
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
  basename: resolveBasename(import.meta.env.BASE_URL),
})
