import { Link } from 'react-router-dom'
import { PackagePlus, Plug } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'

type Variant = 'no-markets' | 'no-activity'

interface DashboardEmptyStateProps {
  /**
   * - `no-markets`: 연결 마켓 0건 — 최우선 hero
   * - `no-activity`: 마켓 ≥1 + 주문·잡 0건
   *
   * 마스터: docs/design-renewal/s2-dashboard.md §6.2
   */
  variant: Variant
}

/**
 * 대시보드 빈 상태 hero. variant 별로 메시지 / CTA 분기.
 */
export function DashboardEmptyState({ variant }: DashboardEmptyStateProps): JSX.Element {
  if (variant === 'no-markets') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <Plug className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-h2 text-text">먼저 마켓을 연결하세요</h2>
            <p className="text-sm text-text-secondary">
              마켓을 연결하면 주문이 자동으로 들어옵니다.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/markets">마켓 연결하기</Link>
          </Button>
          <Link to="/register" className="text-sm text-accent hover:underline">
            상품 등록 둘러보기 →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <PackagePlus className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-h2 text-text">첫 상품을 등록해 보세요</h2>
          <p className="text-sm text-text-secondary">
            한 번 입력하면 여러 마켓에 동시에 올릴 수 있어요.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/register">상품 등록 시작</Link>
        </Button>
        <Link to="/markets" className="text-sm text-accent hover:underline">
          마켓 추가하기 →
        </Link>
      </CardContent>
    </Card>
  )
}
