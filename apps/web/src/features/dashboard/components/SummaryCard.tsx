import type { ReactNode } from 'react'
import { Card, CardContent, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * SummaryCard — 대시보드 KPI 카드 공용.
 * 4상태 (loading / data / error / empty) 처리.
 * 마스터: docs/architecture/v1/features/dashboard.md §5.
 */
export interface SummaryCardProps {
  label: string
  value: ReactNode
  hint?: string
  state?: 'loading' | 'data' | 'error' | 'empty'
  icon?: ReactNode
  className?: string
}

export function SummaryCard({
  label,
  value,
  hint,
  state = 'data',
  icon,
  className,
}: SummaryCardProps): JSX.Element {
  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="flex h-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-text-secondary">{label}</span>
          {icon ? <span className="text-text-tertiary">{icon}</span> : null}
        </div>
        {state === 'loading' ? (
          <Skeleton className="h-8 w-20" />
        ) : state === 'error' ? (
          <div className="text-sm text-danger">불러오기 실패</div>
        ) : state === 'empty' ? (
          <div className="text-2xl font-bold text-text-tertiary">—</div>
        ) : (
          <div className="text-2xl font-bold text-text">{value}</div>
        )}
        {hint ? <div className="text-xs text-text-tertiary">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}
