import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader — 각 페이지 상단 타이틀 + 부제 + 우측 액션 영역.
 * ui-system.md §6 (페이지 헤더 패턴).
 *
 * Stage C: placeholder 페이지 공용. Stage D 이후 actions slot 활용 확장.
 */
export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps): JSX.Element {
  return (
    <header className={cn('mb-6 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-h1-mobile md:text-h1 text-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
