import {
  ClipboardList,
  Cog,
  History,
  LayoutDashboard,
  LifeBuoy,
  PackagePlus,
  Printer,
  Settings,
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'

/**
 * Sidebar — Studio shell 230px 사이드바.
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx `studioShell` (line 70-152).
 *
 * 구조:
 *  1) 상단 브랜드 마크 (ink 사각형 + 이니셜 M) + 워드마크 + 태그라인
 *  2) Nav 그룹 (그룹 타이틀 11px uppercase faint) — 메인 / 판매 / 환경
 *  3) 하단 셀러 mini card (avatar / name / email) — auto margin-top
 *
 * 색상은 globals.css/tailwind 토큰이 PR1 에서 합쳐지기 전까지 Studio 토큰 OKLCH arbitrary
 * (`bg-[oklch(...)]`) 로 명시한다. PR1 머지 후 token alias 로 교체 가능 (별도 sweep PR).
 *
 * 활성 라우트 매칭은 NavLink 가 처리. aria-current="page" 자동 부여.
 * 모바일에서는 MobileNav 가 Sheet 로 동일 본문을 감싸 드로어 출력.
 */

interface NavItem {
  to: string
  label: string
  Icon: typeof LayoutDashboard
  disabled?: boolean
  matchPrefix?: string
  tag?: string
}

interface NavGroup {
  title?: string
  items: readonly NavItem[]
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { to: '/dashboard', label: ko.nav.dashboard, Icon: LayoutDashboard },
      { to: '/register', label: ko.nav.register, Icon: PackagePlus, matchPrefix: '/register' },
      { to: '/history', label: ko.nav.history, Icon: History, matchPrefix: '/history' },
    ],
  },
  {
    title: ko.nav.sales,
    items: [
      { to: '/markets', label: ko.nav.markets, Icon: Store, matchPrefix: '/markets' },
      { to: '/orders', label: ko.nav.shipping.orders, Icon: ShoppingCart, matchPrefix: '/orders' },
      { to: '/shipping/print', label: ko.nav.shipping.print, Icon: Printer },
      { to: '/shipping/dispatch', label: ko.nav.shipping.dispatch, Icon: Truck },
      {
        to: '/shipping/history',
        label: ko.nav.shipping.history,
        Icon: ClipboardList,
        matchPrefix: '/shipping/history',
      },
    ],
  },
  {
    title: ko.nav.env,
    items: [
      {
        to: '/settings/shipping',
        label: ko.nav.shipping.settings,
        Icon: Cog,
        matchPrefix: '/settings/shipping',
      },
      { to: '/settings', label: ko.nav.settings, Icon: Settings },
      { to: '#', label: ko.nav.help, Icon: LifeBuoy, disabled: true },
    ],
  },
] as const

interface SidebarProps {
  onNavigate?: (() => void) | undefined
}

export function Sidebar({ onNavigate }: SidebarProps): JSX.Element {
  return (
    <nav
      role="navigation"
      aria-label={ko.shell.primaryNavLabel}
      className={cn(
        'flex h-full w-full flex-col',
        // Studio shell: 230px sidebar, card bg, 1px border-right (Studio `border` token)
        'md:w-[230px]',
        'bg-[oklch(1_0_0)] dark:bg-[oklch(0.18_0.01_60)]',
        'border-r border-[oklch(0.92_0.008_75)] dark:border-[oklch(0.28_0.01_60)]',
        'px-[14px] py-[18px]',
      )}
    >
      <BrandSection />

      <div className="mt-2 flex flex-col">
        {NAV_GROUPS.map((group, gi) => (
          <NavSection
            key={group.title ?? `g${gi}`}
            group={group}
            isFirst={gi === 0}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <SellerMiniCard />
    </nav>
  )
}

function BrandSection(): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 px-1.5 pb-[18px] pt-1">
      <div
        aria-hidden="true"
        className={cn(
          'grid place-items-center rounded-lg',
          'h-7 w-7',
          // ink background + accent ochre letter
          'bg-[oklch(0.15_0.015_60)] dark:bg-[oklch(0.95_0.008_75)]',
          'text-[15px] font-bold',
          'text-[oklch(0.62_0.14_55)]',
        )}
      >
        M
      </div>
      <div className="min-w-0">
        <div
          className={cn(
            'truncate text-[15px] font-bold leading-tight tracking-[-0.015em]',
            'text-[oklch(0.15_0.015_60)] dark:text-[oklch(0.95_0.008_75)]',
          )}
        >
          {ko.app.name}
        </div>
        <div
          className={cn(
            'mt-[1px] truncate text-[10.5px] leading-tight',
            'text-[oklch(0.68_0.01_60)]',
          )}
        >
          {ko.shell.brandTagline}
        </div>
      </div>
    </div>
  )
}

interface NavSectionProps {
  group: NavGroup
  isFirst: boolean
  onNavigate?: (() => void) | undefined
}

function NavSection({ group, isFirst, onNavigate }: NavSectionProps): JSX.Element {
  return (
    <div className={cn(!isFirst && 'mt-[14px]')}>
      {group.title && (
        <div
          className={cn(
            'px-2 pb-1.5 text-[10.5px] font-semibold uppercase leading-tight tracking-[0.08em]',
            'text-[oklch(0.68_0.01_60)]',
          )}
        >
          {group.title}
        </div>
      )}
      <ul className="flex flex-col gap-[1px]">
        {group.items.map((item) => (
          <li key={item.label}>
            <SidebarItem item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  )
}

interface SidebarItemProps {
  item: NavItem
  onNavigate?: (() => void) | undefined
}

function SidebarItem({ item, onNavigate }: SidebarItemProps): JSX.Element {
  const { Icon, label, to, disabled, matchPrefix, tag } = item

  const baseRow = cn(
    'flex items-center gap-2.5 rounded-[10px]',
    'px-[10px] py-2',
    'text-[13.5px] leading-tight',
    'min-h-11 md:min-h-9', // 모바일 터치 타겟 44
  )

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        tabIndex={-1}
        title="v2 예정"
        className={cn(
          baseRow,
          'font-medium',
          'text-[oklch(0.68_0.01_60)]',
          'cursor-not-allowed opacity-70',
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate">{label}</span>
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
          baseRow,
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.62_0.14_55)] focus-visible:ring-offset-1',
          isActive
            ? cn(
                'bg-[oklch(0.94_0.04_65)]',
                'text-[oklch(0.15_0.015_60)]',
                'font-semibold',
              )
            : cn(
                'font-medium',
                'text-[oklch(0.48_0.012_60)] dark:text-[oklch(0.78_0.01_60)]',
                'hover:bg-[oklch(0.985_0.006_75)] dark:hover:bg-[oklch(0.22_0.01_60)]',
                'hover:text-[oklch(0.22_0.015_60)] dark:hover:text-[oklch(0.95_0.008_75)]',
              ),
        )
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {tag && (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-[7px] py-px',
            'text-[11px] font-semibold',
            'border-[oklch(0.92_0.008_75)] bg-[oklch(0.985_0.006_75)]',
            'text-[oklch(0.48_0.012_60)]',
          )}
        >
          {tag}
        </span>
      )}
    </NavLink>
  )
}

function SellerMiniCard(): JSX.Element {
  return (
    <div
      className={cn(
        'mt-auto rounded-xl p-3',
        'border border-[oklch(0.92_0.008_75)] dark:border-[oklch(0.28_0.01_60)]',
        'bg-[oklch(0.985_0.006_75)] dark:bg-[oklch(0.22_0.01_60)]',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          aria-hidden="true"
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-full',
            'bg-[oklch(0.94_0.04_65)] text-[oklch(0.62_0.14_55)]',
            'text-[13px] font-bold',
          )}
        >
          김
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-[13px] font-semibold leading-tight',
              'text-[oklch(0.15_0.015_60)] dark:text-[oklch(0.95_0.008_75)]',
            )}
          >
            {ko.shell.sellerPlaceholderName}
          </div>
          <div
            className={cn(
              'mt-0.5 truncate text-[11px] leading-tight',
              'text-[oklch(0.68_0.01_60)]',
            )}
          >
            {ko.shell.sellerPlaceholderEmail}
          </div>
        </div>
      </div>
    </div>
  )
}
