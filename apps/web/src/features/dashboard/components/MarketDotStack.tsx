import type { MarketId } from '@/lib/schemas/common'
import { MARKET_IDS } from '@/lib/schemas/common'

// markets/components/MarketStackSummary.tsx 와 동일 brand color (markets.md §7.2).
const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

interface MarketDotStackProps {
  // 점이 활성화되어야 하는 마켓 ID 집합 (예: 잡의 결과에 포함된 마켓)
  active: readonly MarketId[]
  // 5마켓 전체를 표시할지(true), 활성 마켓만 표시할지(false). 기본 false.
  showAll?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/**
 * 마켓 brand color 점 stack — 잡 row / 결과 카드에서 마켓 시각 식별.
 * 색상에만 의존하지 말 것 — aria-label 로 마켓 ID 텍스트도 제공 (ui-system.md §10).
 */
export function MarketDotStack({
  active,
  showAll = false,
  size = 'md',
  className,
}: MarketDotStackProps): JSX.Element {
  const activeSet = new Set(active)
  const list = showAll ? MARKET_IDS : MARKET_IDS.filter((m) => activeSet.has(m))
  const dotClass = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3'

  return (
    <div
      className={`inline-flex items-center gap-1 ${className ?? ''}`}
      role="img"
      aria-label={`마켓: ${active.join(', ') || '없음'}`}
    >
      {list.map((id) => (
        <span
          key={id}
          className={`inline-block rounded-full ${dotClass}`}
          style={{
            backgroundColor: BRAND_COLOR[id],
            opacity: showAll && !activeSet.has(id) ? 0.2 : 1,
          }}
          aria-hidden
        />
      ))}
    </div>
  )
}
