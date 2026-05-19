import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Badge — ui-system.md §7 / §10
 *
 * 기본 variant + RegistrationJob 7상태 매핑:
 *  - pending   → 회색 (surface-muted + tertiary)
 *  - running   → info
 *  - partial   → warning
 *  - succeeded → success
 *  - failed    → danger
 *  - retrying  → info
 *  - cancelled → 회색
 *
 * 색상에만 의존하지 말 것 — 아이콘 + 한글 텍스트 3중 표시 (ui-system.md §10).
 */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-full',
    'px-2 py-0.5 text-xs font-semibold',
    'transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    'whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        default: 'bg-surface-muted text-text-secondary',
        secondary: 'bg-surface-subtle text-text border border-border',
        success: 'bg-success-soft text-success-on-soft',
        warning: 'bg-warning-soft text-warning-on-soft',
        danger: 'bg-danger-soft text-danger-on-soft',
        info: 'bg-info-soft text-info-on-soft',
        // RegistrationJob 상태 — 별도 키로도 노출 (의도 명확화)
        'status-pending': 'bg-surface-muted text-text-tertiary',
        'status-running': 'bg-accent-soft text-accent',
        'status-partial': 'bg-warning-soft text-warning-on-soft',
        'status-succeeded': 'bg-success-soft text-success-on-soft',
        'status-failed': 'bg-danger-soft text-danger-on-soft',
        'status-retrying': 'bg-accent-soft text-accent',
        'status-cancelled': 'bg-surface-muted text-text-tertiary',
      },
      size: {
        sm: 'h-5 text-[11px] px-1.5',
        md: 'h-6 text-xs px-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, size, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ variant, size, className }))} {...props} />
  )
})

export { badgeVariants }
