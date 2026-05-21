import { cn } from '@/lib/utils'
import { MARKET_CATALOG, type MarketId } from '../types'

/**
 * MarketIdentity — 마켓 로고 자리표시 박스 (이니셜 + 브랜드색).
 *
 * Studio s5 와이어 reference: studio-domains.jsx Identity(id, label, size, 'logo')
 * - 사각 라운드 박스 + 브랜드 컬러 배경의 옅은 톤 + 마켓 라벨 첫 글자.
 * - 라이트/다크 모드 무관 단일 톤 (브랜드 가이드라인).
 * - 본 컴포넌트는 시각 식별용 placeholder. 실 로고 SVG 도입 시 교체.
 */
export type MarketIdentitySize = 'sm' | 'md' | 'lg'

interface MarketIdentityProps {
  marketId: MarketId
  size?: MarketIdentitySize
  className?: string
}

const SIZE_CLASS: Record<MarketIdentitySize, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-10 w-10 text-sm',
}

const BG_CLASS: Record<MarketId, string> = {
  naver: 'bg-market-naver/15 text-market-naver',
  coupang: 'bg-market-coupang/15 text-market-coupang',
  gmarket: 'bg-market-gmarket/15 text-market-gmarket',
  auction: 'bg-market-auction/15 text-market-auction',
  '11st': 'bg-market-eleventh/15 text-market-eleventh',
}

const INITIAL: Record<MarketId, string> = {
  naver: 'N',
  coupang: 'C',
  gmarket: 'G',
  auction: 'A',
  '11st': '1',
}

export function MarketIdentity({
  marketId,
  size = 'md',
  className,
}: MarketIdentityProps): JSX.Element {
  const label = MARKET_CATALOG[marketId].label
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-bold tracking-tight',
        SIZE_CLASS[size],
        BG_CLASS[marketId],
        className,
      )}
    >
      {INITIAL[marketId]}
    </span>
  )
}
