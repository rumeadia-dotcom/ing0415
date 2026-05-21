import type { ReactNode } from 'react'
import { Card, CardContent, Skeleton } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * SummaryCard — 대시보드 KPI 카드 공용.
 * 4상태 (loading / data / error / empty) 처리.
 * 마스터: docs/architecture/v1/features/dashboard.md §5
 * 디자인: docs/design-renewal/designFile/concepts/studio.jsx (KPI strip)
 *
 * 시각 hierarchy (Studio):
 *   ① label — uppercase 12 faint weight 600
 *   ② value — display 34 ink weight 700 letter-spacing -0.03em
 *   ③ hint — 11.5 faint + tone dot
 */
export interface SummaryCardProps {
  label: string
  value: ReactNode
  hint?: string
  state?: 'loading' | 'data' | 'error' | 'empty'
  icon?: ReactNode
  /** hint 좌측 tone dot — Studio dashboard KPI strip 의 미니 시각 단서. */
  tone?: 'accent' | 'info' | 'ok' | 'warn' | 'dim'
  className?: string
}

const TONE_DOT: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  accent: 'bg-[oklch(0.62_0.14_55)]',
  info: 'bg-[oklch(0.55_0.10_235)]',
  ok: 'bg-[oklch(0.55_0.10_160)]',
  warn: 'bg-[oklch(0.62_0.12_70)]',
  dim: 'bg-[oklch(0.68_0.01_60)]',
}

export function SummaryCard({
  label,
  value,
  hint,
  state = 'data',
  icon,
  tone = 'dim',
  className,
}: SummaryCardProps): JSX.Element {
  return (
    <Card className={cn('h-full rounded-[14px]', className)}>
      <CardContent className="flex h-full flex-col gap-2 px-[18px] py-[14px] pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[oklch(0.48_0.012_60)]">
            {label}
          </span>
          {icon ? (
            <span className="text-[oklch(0.68_0.01_60)]">{icon}</span>
          ) : null}
        </div>
        {state === 'loading' ? (
          <Skeleton className="h-9 w-20" />
        ) : state === 'error' ? (
          <div className="text-sm text-danger">불러오기 실패</div>
        ) : state === 'empty' ? (
          <div className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[oklch(0.68_0.01_60)]">
            —
          </div>
        ) : (
          <div className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[oklch(0.15_0.015_60)] tabular-nums">
            {value}
          </div>
        )}
        {hint ? (
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[oklch(0.68_0.01_60)]">
            <span
              aria-hidden
              className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])}
            />
            <span className="truncate">{hint}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
