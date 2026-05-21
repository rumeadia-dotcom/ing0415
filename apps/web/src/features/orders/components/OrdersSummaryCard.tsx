import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * 오늘 주문 요약 카드 (n47, 4종) — Studio stat 카드.
 *
 * - 큰 숫자 + 우상단 아이콘 + 하단 힌트.
 * - emphasis="attention" 은 가치값 > 0 일 때 accent (ochre) 강조.
 * - 4상태: loading / data / error / empty (0건은 data 처리, '—' 아닌 '0').
 */
export interface OrdersSummaryCardProps {
  label: string
  value: number
  hint?: string
  state: 'loading' | 'data' | 'error'
  icon?: ReactNode
  emphasis?: 'default' | 'attention'
  className?: string
}

export function OrdersSummaryCard({
  label,
  value,
  hint,
  state,
  icon,
  emphasis = 'default',
  className,
}: OrdersSummaryCardProps): JSX.Element {
  const highlighted = emphasis === 'attention' && state === 'data' && value > 0
  return (
    <article
      className={cn(
        'flex h-full flex-col gap-2 rounded-2xl border bg-surface p-5 shadow-sm transition-colors',
        highlighted ? 'border-accent/30 bg-accent-soft/30' : 'border-border',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-secondary">{label}</span>
        {icon ? (
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-lg',
              highlighted
                ? 'bg-accent/15 text-accent'
                : 'bg-surface-muted text-text-tertiary',
            )}
          >
            {icon}
          </span>
        ) : null}
      </header>
      {state === 'loading' ? (
        <Skeleton className="h-8 w-20" />
      ) : state === 'error' ? (
        <div className="text-sm text-danger">불러오기 실패</div>
      ) : (
        <div
          className={cn(
            'text-3xl font-bold tabular-nums leading-none tracking-tight',
            highlighted ? 'text-accent' : 'text-text',
          )}
        >
          {value.toLocaleString()}
        </div>
      )}
      {hint ? <div className="text-[11.5px] text-text-tertiary">{hint}</div> : null}
    </article>
  )
}
