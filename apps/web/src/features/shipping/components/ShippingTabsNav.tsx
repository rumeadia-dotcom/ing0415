import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'

/**
 * Studio 룩 — segmented tabs (운송장 출력 / 송장 일괄 제출 / 배송 이력).
 *
 * 라우트 wiring 만 담당. 각 페이지에서 PageHeader 위/아래에 배치.
 * 키보드 동선: NavLink 가 a 태그로 렌더링되어 Tab 으로 순회.
 */
const TABS = [
  { to: '/shipping/print', label: ko.shipping.tabs.print },
  { to: '/shipping/dispatch', label: ko.shipping.tabs.dispatch },
  { to: '/shipping/history', label: ko.shipping.tabs.history },
] as const

export function ShippingTabsNav(): JSX.Element {
  return (
    <nav
      aria-label={ko.shipping.tabs.ariaLabel}
      className="mb-4 inline-flex w-fit gap-1 rounded-xl bg-surface-muted p-1"
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn(
              'rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              isActive
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-tertiary hover:text-text',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
