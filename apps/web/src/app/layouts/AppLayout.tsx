import { Outlet } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * AppLayout — Studio shell 인증 셸.
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx `studioShell` (line 70-152).
 *
 * 데스크탑(md+):
 *   - CSS grid: 230px 사이드바 + 1fr 본문 컬럼.
 *   - Sidebar 는 항상 노출 (card bg + border-right).
 *   - 본문 컬럼 최상단 = `Header` (크롬 strip: 테마 토글). 그 아래 페이지의 `PageHeader` (title/sub/CTA) + 컨텐츠.
 *
 * 모바일(<md):
 *   - 단일 컬럼. Sidebar 숨김. `Header` 의 햄버거 → `MobileNav` (Sheet 드로어).
 *   - 본문 좌우 패딩 축소 (PageHeader 가 자체 px-4 적용).
 *
 * 배경: warm off-white (Studio bg 토큰, OKLCH arbitrary).
 * Footer 는 본문 컬럼 하단에 상시 노출 (D-C: 약관 / 개인정보처리방침 / 매뉴얼).
 */
export function AppLayout(): JSX.Element {
  return (
    <div
      className={cn(
        'min-h-screen',
        // Studio bg (warm off-white) — OKLCH arbitrary, PR1 토큰 합류 후 alias 교체 예정
        'bg-[oklch(0.975_0.008_75)] dark:bg-[oklch(0.18_0.01_60)]',
        // Studio shell grid: 230px sidebar + 1fr main (desktop), 단일 컬럼 (모바일)
        'md:grid md:grid-cols-[230px_1fr]',
        // 폰트 — Studio 사양 (Manrope + Pretendard 폴백). 토큰 미합류 상태 안전망.
        'font-sans',
      )}
    >
      <aside className="hidden shrink-0 md:block">
        <Sidebar />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-col">
        <Header />
        {/*
          NOTE: `<main>` 의 패딩은 v0(이전 셸) 기준으로 남겨둔다.
          Studio 셸 사양은 본문 컨텐츠가 `<PageBody>` 로 자체 패딩을 가지는 모델 — 도메인 PR(04-10) 에서
          각 페이지가 `<PageBody>` 를 채택하면 본 fallback 패딩은 제거 sweep 한다.
        */}
        <main className="flex-1 px-4 pb-10 pt-6 md:px-[30px] md:pb-[30px] md:pt-[22px]">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster />
    </div>
  )
}
