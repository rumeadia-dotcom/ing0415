import { History, LayoutDashboard, LifeBuoy, PackagePlus, Settings, Store } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'

/**
 * Sidebar — 5탭 메인 메뉴 + 보조(설정/도움말 disabled).
 * 시각 레퍼런스: docs/frontend_html_design/v1/_shared/chrome.html
 *
 * 활성 라우트 매칭은 NavLink 가 처리 (isActive). aria-current="page" 자동 부여.
 * 모바일에서는 MobileNav 가 Sheet 로 동일 본문을 감싸 드로어 출력.
 */

interface NavItem {
  to: string
  label: string
  Icon: typeof LayoutDashboard
  disabled?: boolean
  matchPrefix?: string // 위저드 5단계처럼 자식 경로 활성화에 사용
}

const MAIN_NAV: readonly NavItem[] = [
  { to: '/dashboard', label: ko.nav.dashboard, Icon: LayoutDashboard },
  { to: '/register', label: ko.nav.register, Icon: PackagePlus, matchPrefix: '/register' },
  { to: '/markets', label: ko.nav.markets, Icon: Store, matchPrefix: '/markets' },
  { to: '/history', label: ko.nav.history, Icon: History, matchPrefix: '/history' },
] as const

const AUX_NAV: readonly NavItem[] = [
  { to: '#', label: ko.nav.settings, Icon: Settings, disabled: true },
  { to: '#', label: ko.nav.help, Icon: LifeBuoy, disabled: true },
] as const

interface SidebarProps {
  onNavigate?: (() => void) | undefined // 모바일 드로어에서 항목 클릭 시 닫기용
}

export function Sidebar({ onNavigate }: SidebarProps): JSX.Element {
  return (
    <nav
      role="navigation"
      aria-label="주요 메뉴"
      className="flex h-full w-full flex-col gap-4 border-r border-border bg-surface px-3 py-4 md:w-64"
    >
      <div className="flex items-center gap-2 px-2 py-1">
        <div
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-bold text-white"
        >
          M
        </div>
        <div className="min-w-0">
          <div className="text-h3 text-text">{ko.app.name}</div>
          <div className="text-xs text-text-tertiary">v1</div>
        </div>
      </div>

      <NavSection title={ko.nav.main} items={MAIN_NAV} onNavigate={onNavigate} />
      <NavSection title={ko.nav.aux} items={AUX_NAV} onNavigate={onNavigate} />
    </nav>
  )
}

interface NavSectionProps {
  title: string
  items: readonly NavItem[]
  onNavigate?: (() => void) | undefined
}

function NavSection({ title, items, onNavigate }: NavSectionProps): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {title}
      </div>
      {items.map((item) => (
        <SidebarItem key={item.label} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

interface SidebarItemProps {
  item: NavItem
  onNavigate?: (() => void) | undefined
}

function SidebarItem({ item, onNavigate }: SidebarItemProps): JSX.Element {
  const { Icon, label, to, disabled, matchPrefix } = item

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        tabIndex={-1}
        title="v2 예정"
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2',
          'text-sm font-medium text-text-tertiary',
          'cursor-not-allowed opacity-60',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      end={!matchPrefix}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-2',
          'text-sm font-medium transition-colors',
          'min-h-11 md:min-h-9', // 모바일 터치 타겟 44
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          isActive
            ? 'bg-accent-soft text-accent'
            : 'text-text-secondary hover:bg-surface-muted hover:text-text',
        )
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  )
}
