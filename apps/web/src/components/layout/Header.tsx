import { Monitor, Moon, Sun } from 'lucide-react'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui'
import { useTheme, type ThemeMode } from '@/lib/use-theme'
import { MobileNav } from './MobileNav'

/**
 * Header — 상단 토픽바.
 * 모바일: 햄버거 + 페이지 타이틀(생략) + 테마 토글
 * 데스크탑: 페이지 타이틀(생략) + 우측 액션 (테마 토글)
 *
 * 페이지 타이틀은 각 페이지의 PageHeader 가 콘텐츠 영역에서 렌더. 헤더는 셸 정보만.
 * Stage D 이후 알림 / 사용자 메뉴 추가 예정.
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
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 md:px-6">
        <div className="md:hidden">
          <MobileNav />
        </div>
        <div className="flex-1" />
        <ThemeToggle />
      </header>
    </TooltipProvider>
  )
}
