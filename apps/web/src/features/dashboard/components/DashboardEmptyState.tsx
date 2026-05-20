import { Link } from 'react-router-dom'
import { PackagePlus } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'

/**
 * 잡 0건 시 hero CTA.
 * 판정: summary.last_job_at === null.
 */
export function DashboardEmptyState(): JSX.Element {
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
          <Link to="/register">첫 상품 등록 시작</Link>
        </Button>
        <Link to="/markets" className="text-sm text-accent hover:underline">
          먼저 마켓 연결하기 →
        </Link>
      </CardContent>
    </Card>
  )
}
