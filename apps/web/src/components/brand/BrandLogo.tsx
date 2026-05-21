import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'

/**
 * BrandLogo — MarketCast 통합 브랜드 로고.
 *
 * 시각 ground truth: Sidebar `BrandSection` (Studio shell).
 * - ink 배경 둥근 사각형 + accent 색 'M' 이니셜 마크
 * - 옆에 'MarketCast' 워드마크 (ink 색, bold, -1.5% tracking)
 * - 선택적 태그라인 (faint)
 *
 * Sidebar (size sm, withTagline) · AuthLayout (size lg, withTagline) 두 곳에서 사용.
 */

type Size = 'sm' | 'md' | 'lg'

interface SizeSpec {
  mark: string
  initial: string
  word: string
  tagline: string
  gap: string
}

const SIZE_MAP: Record<Size, SizeSpec> = {
  sm: {
    mark: 'h-7 w-7 rounded-lg text-[15px]',
    initial: 'text-[15px]',
    word: 'text-[15px] tracking-[-0.015em]',
    tagline: 'text-[10.5px] mt-[1px]',
    gap: 'gap-2.5',
  },
  md: {
    mark: 'h-10 w-10 rounded-[10px] text-[20px]',
    initial: 'text-[20px]',
    word: 'text-[20px] tracking-[-0.02em]',
    tagline: 'text-[12px] mt-0.5',
    gap: 'gap-3',
  },
  lg: {
    mark: 'h-12 w-12 rounded-[12px] text-[24px]',
    initial: 'text-[24px]',
    word: 'text-[24px] tracking-[-0.02em]',
    tagline: 'text-[13px] mt-1',
    gap: 'gap-3',
  },
}

export interface BrandLogoProps {
  size?: Size
  withTagline?: boolean
  className?: string
  'aria-label'?: string
}

export function BrandLogo({
  size = 'sm',
  withTagline = false,
  className,
  'aria-label': ariaLabel = ko.app.name,
}: BrandLogoProps): JSX.Element {
  const spec = SIZE_MAP[size]

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center', spec.gap, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid place-items-center bg-ink text-accent font-bold shrink-0',
          spec.mark,
        )}
      >
        M
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block truncate font-bold leading-tight text-ink',
            spec.word,
          )}
        >
          {ko.app.name}
        </span>
        {withTagline && (
          <span
            className={cn(
              'block truncate leading-tight text-faint',
              spec.tagline,
            )}
          >
            {ko.shell.brandTagline}
          </span>
        )}
      </span>
    </span>
  )
}
