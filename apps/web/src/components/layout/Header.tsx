import { TooltipProvider } from '@/components/ui'
import { cn } from '@/lib/utils'
import { MobileNav } from './MobileNav'

/**
 * Header — Studio shell 의 셸 크롬 (모바일 햄버거).
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx (studioShell `<main><header>` 좌측).
 *
 * Studio shell 의 본문 헤더(title/sub/CTA) 는 `PageHeader` 가 담당한다.
 * 본 `Header` 는 그 위에 얹히는 얇은 크롬 — 모바일에서만 햄버거 노출, 데스크탑은 비어 있음.
 *
 * v1.3 다크모드 제거 (2026-05-22): ThemeToggle / useTheme 훅 / data-theme 'dark' 분기 모두 삭제.
 * 라이트 전용 운영. 재도입 시 globals.css `[data-theme='dark']` 블록 + useTheme 훅 + 토글 UI 동시 복원 필요.
 *
 * border-bottom 없음 — 아래의 PageHeader 가 자체 border-bottom 으로 시각 구획을 만든다.
 */

export function Header(): JSX.Element {
  return (
    <TooltipProvider delayDuration={150}>
      <header
        className={cn(
          'sticky top-0 z-30 flex h-12 items-center gap-2',
          'px-3 md:px-[30px]',
          // Studio bg, no border (PageHeader carries border-bottom)
          'bg-bg',
        )}
      >
        <div className="md:hidden">
          <MobileNav />
        </div>
        <div className="flex-1" />
      </header>
    </TooltipProvider>
  )
}
