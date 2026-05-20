import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { lazy, Suspense } from 'react'
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { ko } from '@/locales/ko'

/**
 * 법적 정적 페이지 라우팅 통합 테스트 — D-C.
 *
 * 검증:
 *  - `/legal/terms`, `/legal/privacy`, `/manual` 3개 라우트가 비인증 상태에서도 접근 가능
 *  - 각 라우트가 정확한 페이지 컴포넌트를 마운트
 *  - PublicLegalShell 의 Footer 가 함께 마운트 (Footer 링크가 보임)
 *
 * 본 테스트는 실제 router.tsx 를 import 하지 않고 동일 구조의 미니 라우터를 구성.
 * 이유: router.tsx 는 `createBrowserRouter` (실제 history) 를 사용해서 jsdom 에서
 * 다중 인스턴스화하면 충돌. 동일 페이지 매핑 / 셸 / lazy 패턴만 재현해 회귀 보장.
 */

const TermsPage = lazy(() => import('../pages/TermsPage'))
const PrivacyPage = lazy(() => import('../pages/PrivacyPage'))
const ManualPage = lazy(() => import('../pages/ManualPage'))

function PublicLegalShell(): JSX.Element {
  return (
    <div>
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function withSuspense(node: JSX.Element): JSX.Element {
  return <Suspense fallback={<div>loading…</div>}>{node}</Suspense>
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLegalShell />,
    children: [
      { path: 'legal/terms', element: withSuspense(<TermsPage />) },
      { path: 'legal/privacy', element: withSuspense(<PrivacyPage />) },
      { path: 'manual', element: withSuspense(<ManualPage />) },
    ],
  },
]

function renderAt(path: string): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe('legal routing (비인증 정적 페이지)', () => {
  it('/legal/terms 진입 시 TermsPage + Footer 가 함께 마운트', async () => {
    renderAt('/legal/terms')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: ko.legal.terms.title }),
      ).toBeInTheDocument()
    })
    // Footer 가 같은 셸에 마운트되었는지
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: ko.footer.privacy })).toBeInTheDocument()
  })

  it('/legal/privacy 진입 시 PrivacyPage 가 마운트', async () => {
    renderAt('/legal/privacy')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: ko.legal.privacy.title }),
      ).toBeInTheDocument()
    })
  })

  it('/manual 진입 시 ManualPage 가 마운트', async () => {
    renderAt('/manual')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: ko.legal.manual.title }),
      ).toBeInTheDocument()
    })
  })
})
