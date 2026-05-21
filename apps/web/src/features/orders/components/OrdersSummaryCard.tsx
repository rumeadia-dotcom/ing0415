import type { ReactNode } from 'react'
import { Card, CardContent, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * 오늘 주문 요약 카드 (n47, 4종).
 * SummaryCard 와 동일 패턴이지만 orders 전용 시각 강조(value 큰 폰트, 아이콘 색).
 *
 * 4상태: loading / data / error / empty(0건은 data 처리, '—' 가 아닌 '0').
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
  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-text-secondary">{label}</span>
          {icon ? (
            <span
              className={cn(
                emphasis === 'attention' ? 'text-warning' : 'text-text-tertiary',
              )}
            >
              {icon}
            </span>
          ) : null}
        </div>
        {state === 'loading' ? (
          <Skeleton className="h-8 w-20" />
        ) : state === 'error' ? (
          <div className="text-sm text-danger">불러오기 실패</div>
        ) : (
          <div
            className={cn(
              'text-3xl font-bold tabular-nums',
              emphasis === 'attention' && value > 0 ? 'text-warning' : 'text-text',
            )}
          >
            {value.toLocaleString()}
          </div>
        )}
        {hint ? <div className="text-xs text-text-tertiary">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}
