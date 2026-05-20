import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * BrandMark — MarketCast 심볼 (Sparkline M, halo finish).
 *
 * 원본: docs/design/brand/symbol.jsx (MarkSparkline halo locked variant).
 * - viewBox 120×120. M 글자가 차트선처럼 두 봉우리로 상승.
 * - 정점(82,22)에 halo 링 — '브로드캐스트' 메타포.
 * - gradient id 충돌 회피용 useId() — 동일 페이지에 여러 BrandMark 가 마운트돼도 안전.
 *
 * v1 은 halo 단일 finish 만 노출 (YAGNI). 추가 finish (clean/flag/tick/apex) 는 v2.
 */

export type BrandMarkTone = 'gradient' | 'navy' | 'white'

export interface BrandMarkProps {
  /** SVG 한 변 길이 (px). 기본 32. */
  size?: number
  /** stroke 색상 톤. 기본 'gradient'. */
  tone?: BrandMarkTone
  /** 접근성 라벨. 지정 시 role="img", 미지정 시 aria-hidden="true". */
  'aria-label'?: string
  className?: string
}

export function BrandMark({
  size = 32,
  tone = 'gradient',
  'aria-label': ariaLabel,
  className,
}: BrandMarkProps): JSX.Element {
  const uid = useId().replace(/[:]/g, '')
  const gid = `mc-grad-${uid}`

  const stroke =
    tone === 'gradient' ? `url(#${gid})` : tone === 'navy' ? '#0A2540' : '#FFFFFF'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={cn('shrink-0', className)}
    >
      {tone === 'gradient' && (
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1747C2" />
            <stop offset="55%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
      )}
      {/* Sparkline M — 두 봉우리, 두번째가 더 높음 (시장 상승) */}
      <path
        d="M18 90 L42 42 L60 70 L82 22 L102 90"
        stroke={stroke}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* halo 링 — 정점 브로드캐스트 액센트 */}
      <circle cx={82} cy={22} r={10} stroke={stroke} strokeWidth={2.2} fill="none" opacity={0.9} />
    </svg>
  )
}
