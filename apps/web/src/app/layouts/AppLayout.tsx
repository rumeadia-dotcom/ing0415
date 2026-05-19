import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/ui'

/**
 * AppLayout — 인증된 사용자용 셸.
 * 좌측 Sidebar (md+ 에서만 표시) + 우측 Header + Outlet.
 *
 * 모바일(<md): Sidebar 숨김, Header 의 햄버거 → MobileNav(Sheet 드로어).
 * 데스크탑(md+): Sidebar 고정 너비 256px, 본문은 flex-1.
 *
 * 인증 가드는 Stage E 이후 (RequireAuth HOC) 도입 예정.
 */
export function AppLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-surface-subtle">
      <aside className="hidden shrink-0 md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
