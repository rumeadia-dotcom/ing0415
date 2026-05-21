import { Monitor, Moon, Sun } from 'lucide-react'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { useTheme, type ThemeMode } from '@/lib/use-theme'
import { cn } from '@/lib/utils'
import { MobileNav } from './MobileNav'

/**
 * Header — Studio shell 의 셸 크롬 (모바일 햄버거 + 테마 토글).
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx (studioShell `<main><header>` 좌측).
 *
 * Studio shell 의 본문 헤더(title/sub/CTA) 는 `PageHeader` 가 담당한다.
 * 본 `Header` 는 그 위에 얹히는 얇은 크롬 — 모바일에서만 햄버거 노출, 데스크탑은 테마 토글만.
 *
 * border-bottom 없음 — 아래의 PageHeader 가 자체 border-bottom 으로 시각 구획을 만든다.
 */

const THEME_ICON: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const THEME_LABEL: Record<ThemeMode, string> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
}

function ThemeToggle(): JSX.Element {
  const { theme, resolved, toggle } = useTheme()
  const Icon = THEME_ICON[theme]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={`테마 변경 — 현재 ${THEME_LABEL[theme]} (실제 ${resolved === 'dark' ? '다크' : '라이트'})`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        현재: {THEME_LABEL[theme]} · 실제 {resolved === 'dark' ? '다크' : '라이트'}
      </TooltipContent>
    </Tooltip>
  )
}

export function Header(): JSX.Element {
  return (
    <TooltipProvider delayDuration={150}>
      <header
        className={cn(
          'sticky top-0 z-30 flex h-12 items-center gap-2',
          'px-3 md:px-[30px]',
          // Studio bg, no border (PageHeader carries border-bottom)
          'bg-[oklch(0.975_0.008_75)] dark:bg-[oklch(0.18_0.01_60)]',
        )}
      >
        <div className="md:hidden">
          <MobileNav />
        </div>
        <div className="flex-1" />
        <ThemeToggle />
      </header>
    </TooltipProvider>
  )
}
