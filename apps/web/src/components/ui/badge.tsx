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
    'focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-card-2 text-dim border border-border',
        secondary:
          'bg-white text-ink border border-border',
        success:
          'bg-success-soft text-success-on-soft',
        warning:
          'bg-warning-soft text-warning-on-soft',
        danger:
          'bg-danger-soft text-danger-on-soft',
        info:
          'bg-info-soft text-info-on-soft',
        accent:
          'bg-accent-soft text-accent-onlight',
        neutral:
          'bg-card-2 text-faint',
        // RegistrationJob 상태 별칭 (의도 명확화)
        'status-pending':
          'bg-card-2 text-faint',
        'status-running':
          'bg-info-soft text-info-on-soft',
        'status-partial':
          'bg-warning-soft text-warning-on-soft',
        'status-succeeded':
          'bg-success-soft text-success-on-soft',
        'status-failed':
          'bg-danger-soft text-danger-on-soft',
        'status-retrying':
          'bg-info-soft text-info-on-soft',
        'status-cancelled':
          'bg-card-2 text-faint',
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

/**
 * Dot color는 globals.css 의 CSS 변수를 직접 참조해 light/dark 자동 전환.
 * 인라인 style 대신 className 으로 처리하기 위해 Tailwind named token (bg-success / bg-warning ...) 사용.
 */
const DOT_BG_CLASS_BY_VARIANT: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
  neutral: 'bg-faint',
  default: 'bg-dim',
  secondary: 'bg-dim',
  'status-pending': 'bg-faint',
  'status-running': 'bg-info',
  'status-partial': 'bg-warning',
  'status-succeeded': 'bg-success',
  'status-failed': 'bg-danger',
  'status-retrying': 'bg-info',
  'status-cancelled': 'bg-faint',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, size, withDot = false, children, ...props },
  ref,
) {
  const dotBg = DOT_BG_CLASS_BY_VARIANT[variant ?? 'default'] ?? 'bg-dim'
  return (
    <span ref={ref} className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {withDot ? (
        <span
          aria-hidden="true"
          className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', dotBg)}
        />
      ) : null}
      {children}
    </span>
  )
})

export { badgeVariants }
