import { BrandMark } from './BrandMark'
import { cn } from '@/lib/utils'

/**
 * Wordmark — 'MarketCast' 워드마크.
 *
 * - Plus Jakarta Sans 700 / letter-spacing -3.5%.
 * - 'Market' = navy, 'Cast' = 브랜드 그래디언트 (two-tone).
 * - tone 으로 mono/white/gradall 변형 (다크 배경/그래디언트 hero 등).
 * - withMark=true 면 BrandMark + Wordmark 가로 배치 (사이드바·AuthLayout·헤더 기본형).
 */

type Size = 'sm' | 'md' | 'lg' | 'xl'
type Tone = 'two-tone' | 'mono' | 'white' | 'gradall'

const SIZE_MAP: Record<Size, { font: string; mark: number; gap: string }> = {
  sm: { font: 'text-[14px]', mark: 18, gap: 'gap-1.5' },
  md: { font: 'text-[18px]', mark: 24, gap: 'gap-2' },
  lg: { font: 'text-[24px]', mark: 32, gap: 'gap-2.5' },
  xl: { font: 'text-[36px]', mark: 44, gap: 'gap-3' },
}

const TONE_CLASS: Record<
  Tone,
  { left: string; right: string; markTone: 'gradient' | 'navy' | 'white' }
> = {
  'two-tone': { left: 'text-navy', right: 'text-brand-grad', markTone: 'gradient' },
  mono: { left: 'text-text', right: 'text-text', markTone: 'navy' },
  white: { left: 'text-white', right: 'text-white', markTone: 'white' },
  gradall: { left: 'text-brand-grad', right: 'text-brand-grad', markTone: 'gradient' },
}

export interface WordmarkProps {
  size?: Size
  tone?: Tone
  withMark?: boolean
  className?: string
  /** 접근성 라벨 — 미지정 시 'MarketCast'. */
  'aria-label'?: string
}

export function Wordmark({
  size = 'md',
  tone = 'two-tone',
  withMark = false,
  className,
  'aria-label': ariaLabel = 'MarketCast',
}: WordmarkProps): JSX.Element {
  const { font, mark, gap } = SIZE_MAP[size]
  const t = TONE_CLASS[tone]

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center leading-none', gap, className)}
    >
      {withMark && <BrandMark size={mark} tone={t.markTone} />}
      <span className={cn('font-brand font-bold tracking-[-0.035em] leading-none', font)}>
        <span className={t.left}>Market</span>
        <span className={t.right}>Cast</span>
      </span>
    </span>
  )
}
