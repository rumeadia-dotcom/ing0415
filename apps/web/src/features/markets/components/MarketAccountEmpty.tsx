import { Link } from 'react-router-dom'
import { Button, Card, CardContent } from '@/components/ui'
import { ko } from '@/locales/ko'
import { MARKET_IDS, MARKET_CATALOG } from '../types'
import { MarketIdentity } from './MarketIdentity'

/**
 * 연결된 마켓 0개 일 때의 empty state.
 * Studio s5 톤: 큰 카드 + identity 행 미리보기 + 큰 CTA + 보조 힌트.
 */
export function MarketAccountEmpty(): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-4 py-3">
          {MARKET_IDS.map((id) => (
            <MarketIdentity
              key={id}
              marketId={id}
              size="md"
              className={MARKET_CATALOG[id].status === 'coming_soon' ? 'opacity-40' : ''}
            />
          ))}
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-text">{ko.markets.empty.title}</h3>
          <p className="text-sm text-text-secondary">{ko.markets.empty.body}</p>
        </div>
        <Button asChild variant="primary" size="lg">
          <Link to="/markets/connect">{ko.markets.empty.cta}</Link>
        </Button>
        <p className="text-[12px] text-text-tertiary">{ko.markets.empty.hint}</p>
      </CardContent>
    </Card>
  )
}
