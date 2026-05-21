import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Badge (Pill) — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Pill 모양: radius 999, padding 4/10, fontSize 12, weight 600, inline-flex gap 6.
 * 좌측 6×6 colored dot 은 사용처에서 `<span class="dot" />` 로 명시 (variant 매핑된 색 사용).
 *
 * RegistrationJob 7상태 매핑:
 *  - pending   → neutral (faint)
 *  - running   → info
 *  - partial   → warn
 *  - succeeded → ok
 *  - failed    → danger
 *  - retrying  → info
 *  - cancelled → neutral
 *
 * 색상에만 의존하지 말 것 — 아이콘/도트 + 한글 텍스트 3중 표시.
 *
 * Studio 시맨틱 페어 (fg / bg):
 *  - ok    : oklch(0.55 0.10 160) / oklch(0.95 0.03 160)
 *  - warn  : oklch(0.62 0.12 70)  / oklch(0.95 0.04 75)
 *  - danger: oklch(0.55 0.16 25)  / oklch(0.95 0.03 25)
 *  - info  : oklch(0.55 0.10 235) / oklch(0.95 0.025 235)
 *  - accent: oklch(0.62 0.14 55)  / oklch(0.94 0.04 65)
 *  - neutral (v2 예정 등): faint / card2
 */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5 rounded-full',
    'px-[10px] py-[4px] text-[12px] font-semibold',
    'transition-colors whitespace-nowrap',
    'focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.14_55_/_0.4)] focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-[oklch(0.985_0.006_75)] text-[oklch(0.48_0.012_60)] border border-[oklch(0.92_0.008_75)]',
        secondary:
          'bg-white text-[oklch(0.15_0.015_60)] border border-[oklch(0.92_0.008_75)]',
        success:
          'bg-[oklch(0.95_0.03_160)] text-[oklch(0.55_0.10_160)]',
        warning:
          'bg-[oklch(0.95_0.04_75)] text-[oklch(0.62_0.12_70)]',
        danger:
          'bg-[oklch(0.95_0.03_25)] text-[oklch(0.55_0.16_25)]',
        info:
          'bg-[oklch(0.95_0.025_235)] text-[oklch(0.55_0.10_235)]',
        accent:
          'bg-[oklch(0.94_0.04_65)] text-[oklch(0.62_0.14_55)]',
        neutral:
          'bg-[oklch(0.985_0.006_75)] text-[oklch(0.68_0.01_60)]',
        // RegistrationJob 상태 별칭 (의도 명확화)
        'status-pending':
          'bg-[oklch(0.985_0.006_75)] text-[oklch(0.68_0.01_60)]',
        'status-running':
          'bg-[oklch(0.95_0.025_235)] text-[oklch(0.55_0.10_235)]',
        'status-partial':
          'bg-[oklch(0.95_0.04_75)] text-[oklch(0.62_0.12_70)]',
        'status-succeeded':
          'bg-[oklch(0.95_0.03_160)] text-[oklch(0.55_0.10_160)]',
        'status-failed':
          'bg-[oklch(0.95_0.03_25)] text-[oklch(0.55_0.16_25)]',
        'status-retrying':
          'bg-[oklch(0.95_0.025_235)] text-[oklch(0.55_0.10_235)]',
        'status-cancelled':
          'bg-[oklch(0.985_0.006_75)] text-[oklch(0.68_0.01_60)]',
      },
      size: {
        sm: 'text-[11px] px-2 py-[2px]',
        md: 'text-[12px] px-[10px] py-[4px]',
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
    VariantProps<typeof badgeVariants> {
  /** 좌측 dot 표시 여부 (default true for status-* variants 추천) */
  withDot?: boolean
}

const DOT_COLOR_BY_VARIANT: Record<string, string> = {
  success: 'oklch(0.55 0.10 160)',
  warning: 'oklch(0.62 0.12 70)',
  danger: 'oklch(0.55 0.16 25)',
  info: 'oklch(0.55 0.10 235)',
  accent: 'oklch(0.62 0.14 55)',
  neutral: 'oklch(0.68 0.01 60)',
  default: 'oklch(0.48 0.012 60)',
  secondary: 'oklch(0.48 0.012 60)',
  'status-pending': 'oklch(0.68 0.01 60)',
  'status-running': 'oklch(0.55 0.10 235)',
  'status-partial': 'oklch(0.62 0.12 70)',
  'status-succeeded': 'oklch(0.55 0.10 160)',
  'status-failed': 'oklch(0.55 0.16 25)',
  'status-retrying': 'oklch(0.55 0.10 235)',
  'status-cancelled': 'oklch(0.68 0.01 60)',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, size, withDot = false, children, ...props },
  ref,
) {
  const dotColor = DOT_COLOR_BY_VARIANT[variant ?? 'default'] ?? 'oklch(0.48 0.012 60)'
  return (
    <span ref={ref} className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {withDot ? (
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      ) : null}
      {children}
    </span>
  )
})

export { badgeVariants }
