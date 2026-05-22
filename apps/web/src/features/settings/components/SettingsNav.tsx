import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'

/**
 * SettingsNav — 설정 도메인 내부 좌측 네비게이션.
 *
 * 마스터: docs/design-renewal/s9-settings.md §3 (Settings 메뉴 트리)
 *        docs/design-renewal/designFile/concepts/studio-domains.jsx StudioSettings (좌측 220px inner nav)
 *
 * 책임:
 *  - v1 활성 항목: 계정(`/settings`), 배송 설정(`/settings/shipping`)
 *  - v2 예정 항목: 알림 / 청구 / 팀 / 개발자 (faint 색 + v2 pill)
 *  - 데스크탑(md+): 좌측 sticky 220px 컬럼
 *  - 모바일(<md): 가로 스크롤 chip strip — sidebar drawer 가 별도로 있으므로 본 컴포넌트는 도메인 보조 네비
 *
 * 접근성:
 *  - aria-current="page" 로 활성 항목 표시
 *  - v2 항목은 `aria-disabled` + `tabIndex=-1` (네비게이션 불가)
 */

interface NavItem {
  label: string
  to?: string
  v2?: boolean
}

export interface SettingsNavProps {
  /** 현재 활성 항목을 강제 지정. 미지정 시 `useLocation()` 기반 자동 매칭. */
  active?: 'account' | 'shipping' | 'policies'
}

export function SettingsNav({ active }: SettingsNavProps): JSX.Element {
  const loc = useLocation()
  const path = loc.pathname

  const items: readonly (NavItem & { key: string })[] = [
    { key: 'account', label: ko.settings.nav.account, to: '/settings' },
    { key: 'shipping', label: ko.settings.nav.shipping, to: '/settings/shipping' },
    { key: 'policies', label: ko.settings.nav.policies, to: '/settings/policies' },
    { key: 'notifications', label: ko.settings.nav.notifications, v2: true },
    { key: 'billing', label: ko.settings.nav.billing, v2: true },
    { key: 'team', label: ko.settings.nav.team, v2: true },
    { key: 'developer', label: ko.settings.nav.developer, v2: true },
  ]

  function isActive(item: NavItem & { key: string }): boolean {
    if (active) return active === item.key
    if (!item.to) return false
    if (item.to === '/settings') return path === '/settings'
    return path === item.to || path.startsWith(`${item.to}/`)
  }

  return (
    <nav
      aria-label={ko.settings.nav.heading}
      className={cn(
        // 모바일: 가로 스크롤 chip strip
        'flex gap-1 overflow-x-auto pb-2',
        // 데스크탑: 좌측 sticky 컬럼
        'md:flex-col md:gap-0.5 md:overflow-visible md:pb-0',
        'md:sticky md:top-20',
      )}
    >
      <div
        className={cn(
          'hidden md:mb-2 md:block',
          'text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary',
        )}
      >
        {ko.settings.nav.heading}
      </div>
      {items.map((item) => {
        const activeNow = isActive(item)
        const baseClasses = cn(
          // 모바일 칩 / 데스크탑 row 공용
          'inline-flex shrink-0 items-center justify-between gap-2',
          'rounded-md px-3 py-2 text-sm font-medium',
          // 터치 타겟 ≥44px
          'min-h-[44px]',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        )
        const stateClasses = activeNow
          ? 'bg-accent-soft text-text font-semibold'
          : item.v2
            ? 'text-text-tertiary'
            : 'text-text-secondary hover:bg-surface-subtle hover:text-text'

        if (item.v2 || !item.to) {
          return (
            <span
              key={item.key}
              aria-disabled="true"
              className={cn(baseClasses, stateClasses, 'cursor-not-allowed select-none')}
            >
              <span>{item.label}</span>
              <span
                className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-text-tertiary"
                aria-label={`${item.label} ${ko.settings.nav.v2Pill}`}
              >
                {ko.settings.nav.v2Pill}
              </span>
            </span>
          )
        }

        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={activeNow ? 'page' : undefined}
            className={cn(baseClasses, stateClasses)}
          >
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
