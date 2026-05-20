import { Link } from 'react-router-dom'
import { Button, Card, CardContent } from '@/components/ui'

/**
 * 연결된 마켓 0개 일 때 보여주는 empty state CTA.
 * markets.md §8.
 */
export function MarketAccountEmpty(): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-3xl"
        >
          🔌
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-text">아직 연결된 마켓이 없습니다.</h3>
          <p className="text-sm text-text-secondary">
            상품을 등록하려면 먼저 1개 이상의 마켓 계정을 연결하세요.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link to="/markets/connect">+ 첫 마켓 연결하기</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
