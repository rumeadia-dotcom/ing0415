import type { MarketId } from '@/lib/schemas/common'

/**
 * Studio 'logo' market identity — colored square with initial.
 * 마스터: docs/design-renewal/designFile/concepts/studio-tokens.jsx
 *
 * 사이드바·정렬/리스트 화면(s7·s2)에서 brand color + initial 박스 식별 패턴.
 * Studio 토큰 OKLCH 값을 직접 arbitrary class 로 사용한다 (Tailwind config 토큰화는
 * 디자인 리뉴얼 확정 이후 별도 PR 에서 처리).
 */

const MARKET_BG: Record<MarketId, string> = {
  naver: 'bg-[oklch(0.62_0.16_152)]',
  coupang: 'bg-[oklch(0.60_0.21_22)]',
  gmarket: 'bg-[oklch(0.58_0.14_175)]',
  auction: 'bg-[oklch(0.62_0.19_38)]',
  '11st': 'bg-[oklch(0.60_0.22_0)]',
}

const MARKET_INITIAL: Record<MarketId, string> = {
  naver: 'N',
  coupang: 'C',
  gmarket: 'G',
  auction: 'A',
  '11st': '11',
}

interface MarketLogoProps {
  id: MarketId
  /** sm=18px / md=22px / lg=28px. 기본 md. */
  size?: 'sm' | 'md' | 'lg'
  /** screen reader label (시각만 의존 금지 — 마켓 한국어명 부모에서 함께 노출). */
  label?: string
}

const SIZE_CLASS: Record<NonNullable<MarketLogoProps['size']>, string> = {
  sm: 'h-[18px] w-[18px] text-[10px]',
  md: 'h-[22px] w-[22px] text-[11px]',
  lg: 'h-7 w-7 text-xs',
}

export function MarketLogo({ id, size = 'md', label }: MarketLogoProps): JSX.Element {
  return (
    <span
      aria-label={label ?? id}
      role={label ? 'img' : undefined}
      aria-hidden={!label}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-[5px] font-bold leading-none text-white',
        MARKET_BG[id],
        SIZE_CLASS[size],
      ].join(' ')}
    >
      {MARKET_INITIAL[id]}
    </span>
  )
}
