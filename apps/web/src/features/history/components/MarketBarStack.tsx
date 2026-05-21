import type { MarketId } from '@/lib/schemas/common'

const BAR_BG: Record<MarketId, string> = {
  naver: 'bg-market-naver',
  coupang: 'bg-market-coupang',
  gmarket: 'bg-market-gmarket',
  auction: 'bg-market-auction',
  '11st': 'bg-market-eleventh',
}

interface MarketBarStackProps {
  active: readonly MarketId[]
  className?: string
}

/**
 * 데이터 밀도 높은 테이블 행/이력 row 에서 사용하는 마켓 식별 — 작은 세로 컬러 바 스택.
 * Studio 권장 'bar' identity variant (studio-tokens.jsx). 색상 + aria-label 2중 표시.
 */
export function MarketBarStack({
  active,
  className,
}: MarketBarStackProps): JSX.Element {
  return (
    <div
      className={`inline-flex items-center gap-1 ${className ?? ''}`}
      role="img"
      aria-label={`마켓: ${active.join(', ') || '없음'}`}
    >
      {active.map((id) => (
        <span
          key={id}
          aria-hidden
          className={`inline-block h-4 w-[3px] rounded-sm ${BAR_BG[id]}`}
        />
      ))}
    </div>
  )
}
