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
import { BrandLogo } from '@/components/brand'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import { useMarketAccounts } from '@/features/markets/hooks/useMarketAccounts'
import { useLogenCredentialsStatus } from '@/features/settings/shipping/hooks/useLogenCredentialsStatus'

/**
 * Sidebar — Studio shell 230px 사이드바.
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx `studioShell` (line 70-152).
 *
 * 구조:
 *  1) 상단 브랜드 마크 (ink 사각형 + 이니셜 M) + 워드마크 + 태그라인
 *  2) Nav 그룹 (그룹 타이틀 11px uppercase faint) — 메인 / 판매 / 환경
 *  3) 하단 셀러 mini card (avatar / name / email) — auto margin-top
 *
 * 색상은 globals.css / tailwind.config.ts 의 named token (bg / card / ink / dim / faint / accent / border …) 만 사용.
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
  requiresMarket?: boolean
  requiresLogen?: boolean
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
      {
        to: '/orders',
        label: ko.nav.shipping.orders,
        Icon: ShoppingCart,
        matchPrefix: '/orders',
      },
      {
        to: '/shipping/print',
        label: ko.nav.shipping.print,
        Icon: Printer,
      },
      {
        to: '/shipping/dispatch',
        label: ko.nav.shipping.dispatch,
        Icon: Truck,
      },
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
  const { data: accounts } = useMarketAccounts()
  const { data: logenStatus } = useLogenCredentialsStatus()

  const hasMarket = (accounts ?? []).some((a) => a.status === 'active')
  const hasLogen = logenStatus?.hasCredentials ?? false

  function resolveDisabled(item: NavItem): { disabled: boolean; reason: string } {
    if (item.disabled) return { disabled: true, reason: 'v2 예정' }
    if (item.requiresMarket && !hasMarket)
      return { disabled: true, reason: ko.nav.guard.requiresMarket }
    if (item.requiresLogen && !hasLogen)
      return { disabled: true, reason: ko.nav.guard.requiresLogen }
    return { disabled: false, reason: '' }
  }

  return (
    <nav
      role="navigation"
      aria-label={ko.shell.primaryNavLabel}
      className={cn(
        'flex h-full w-full flex-col',
        // Studio shell: 230px sidebar, card bg, 1px border-right (Studio `border` token)
        'md:w-[230px]',
        'bg-card',
        'border-r border-border',
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
            resolveDisabled={resolveDisabled}
          />
        ))}
      </div>

      <SellerMiniCard />
    </nav>
  )
}

function BrandSection(): JSX.Element {
  return (
    <div className="px-1.5 pb-[18px] pt-1">
      <BrandLogo size="sm" withTagline />
    </div>
  )
}

interface NavSectionProps {
  group: NavGroup
  isFirst: boolean
  onNavigate?: (() => void) | undefined
  resolveDisabled: (item: NavItem) => { disabled: boolean; reason: string }
}

function NavSection({ group, isFirst, onNavigate, resolveDisabled }: NavSectionProps): JSX.Element {
  return (
    <div className={cn(!isFirst && 'mt-[14px]')}>
      {group.title && (
        <div
          className={cn(
            'px-2 pb-1.5 text-[10.5px] font-semibold uppercase leading-tight tracking-[0.08em]',
            'text-faint',
          )}
        >
          {group.title}
        </div>
      )}
      <ul className="flex flex-col gap-[1px]">
        {group.items.map((item) => {
          const { disabled, reason } = resolveDisabled(item)
          return (
            <li key={item.label}>
              <SidebarItem
                item={item}
                onNavigate={onNavigate}
                disabled={disabled}
                disabledReason={reason}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface SidebarItemProps {
  item: NavItem
  onNavigate?: (() => void) | undefined
  disabled: boolean
  disabledReason: string
}

function SidebarItem({ item, onNavigate, disabled, disabledReason }: SidebarItemProps): JSX.Element {
  const { Icon, label, to, matchPrefix, tag } = item

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
        title={disabledReason}
        className={cn(
          baseRow,
          'font-medium',
          'text-faint',
          'cursor-not-allowed opacity-50',
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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          isActive
            ? cn(
                'bg-accent-soft',
                'text-ink',
                'font-semibold',
              )
            : cn(
                'font-medium',
                'text-dim',
                'hover:bg-card-2',
                'hover:text-text',
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
            'border-border bg-card-2',
            'text-dim',
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
        'border border-border',
        'bg-card-2',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          aria-hidden="true"
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-full',
            'bg-accent-soft text-accent',
            'text-[13px] font-bold',
          )}
        >
          김
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-[13px] font-semibold leading-tight',
              'text-ink',
            )}
          >
            {ko.shell.sellerPlaceholderName}
          </div>
          <div
            className={cn(
              'mt-0.5 truncate text-[11px] leading-tight',
              'text-faint',
            )}
          >
            {ko.shell.sellerPlaceholderEmail}
          </div>
        </div>
      </div>
    </div>
  )
}
