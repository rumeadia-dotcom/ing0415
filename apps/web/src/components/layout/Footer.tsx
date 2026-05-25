import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ko } from '@/locales/ko'

/**
 * Footer — AppLayout / AuthLayout 공통 푸터.
 * D-C 요구사항: 약관 / 개인정보처리방침 / 매뉴얼 링크 상시 노출 + 저작권 표기.
 *
 * - 비인증 라우트(`/login`, `/legal/*` 등) 에서도 동일 푸터 표시 → AuthLayout 에도 마운트.
 * - 링크는 React Router `<Link>` 로 SPA 내비게이션.
 * - 모바일에서는 세로 스택, sm+ 에서는 한 줄 정렬.
 */
export interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps): JSX.Element {
  return (
    <footer
      role="contentinfo"
      aria-label={ko.footer.nav}
      className={cn(
        'border-t border-border bg-surface px-4 py-4 text-xs text-text-secondary md:px-8',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <nav
          aria-label={ko.footer.nav}
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          <FooterLink to="/legal/terms">{ko.footer.terms}</FooterLink>
          <span aria-hidden="true" className="text-text-tertiary">
            |
          </span>
          <FooterLink to="/legal/privacy">{ko.footer.privacy}</FooterLink>
          <span aria-hidden="true" className="text-text-tertiary">
            |
          </span>
          <FooterLink to="/manual">{ko.footer.manual}</FooterLink>
        </nav>
        <p className="text-text-tertiary">{ko.footer.copyright}</p>
      </div>
    </footer>
  )
}

interface FooterLinkProps {
  to: string
  children: React.ReactNode
}

function FooterLink({ to, children }: FooterLinkProps): JSX.Element {
  return (
    <Link
      to={to}
      className={cn(
        // PRD §5.2 모바일 터치 타겟 — inline-flex 로 44px 높이 보장 (md+ 에서는 자연 height)
        'inline-flex min-h-[44px] items-center rounded px-1 text-text-secondary transition-colors',
        'hover:text-text hover:underline md:min-h-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
      )}
    >
      {children}
    </Link>
  )
}
