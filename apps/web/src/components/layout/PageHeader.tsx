import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader — Studio shell 본문 상단의 title / sub / CTA 헤더.
 * 시각 레퍼런스: docs/design-renewal/designFile/concepts/studio.jsx `studioShell` 의 `<header>` (line 138-147).
 *
 * 사양:
 *  - padding 22 / 30 / 18 (top / x / bottom). 모바일은 x 패딩 축소.
 *  - left: title (22-26px ink, weight 700, tracking -0.02em) + sub (13.5px dim, marginTop 2-4).
 *  - right: optional `actions` 슬롯 — Primary CTA + Secondary 액션 묶음.
 *  - border-bottom 1px (Studio `border` 토큰 OKLCH).
 *
 * 페이지 상단에 항상 본 컴포넌트를 둔다. `Header` (크롬 strip) 의 아래에 위치하며
 * 본 컴포넌트의 padding-x 가 본문 컨텐츠 영역의 좌우 여백 기준선이 된다.
 */
export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps): JSX.Element {
  // document.title 동기화 — 탭 식별 + 화면 리더 페이지 변경 announcement.
  // cycle 30: 본 컴포넌트는 모든 메인 페이지의 1st heading 이므로 단일 진입점으로 활용.
  useEffect(() => {
    const original = document.title
    document.title = `${title} · MarketCast`
    return () => {
      document.title = original
    }
  }, [title])

  return (
    <header
      className={cn(
        // 본문 max-width 컨테이너 안에서 사용되는 패턴 (v1) — 좌우 패딩은 부모(main / PageBody / max-width wrapper) 가 제공.
        // Studio 셸의 full-width border-bottom 패턴은 도메인 PR(04-10) 에서 PageHeader 를 max-width wrapper 외부로 이동시킬 때 자연스럽게 달성.
        'mb-5 flex items-start justify-between gap-4 pb-[18px]',
        'border-b border-border',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1
          className={cn(
            'truncate text-[22px] font-bold leading-tight tracking-[-0.02em]',
            'md:text-[26px]',
            'text-ink',
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              'mt-1 text-[13.5px] leading-snug',
              'text-dim',
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}
