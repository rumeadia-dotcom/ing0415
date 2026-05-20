import { Link } from 'react-router-dom'
import { Button, Card, CardContent } from '@/components/ui'

interface HistoryEmptyStateProps {
  /** true = 필터가 모두 디폴트인데 0건 (등록 자체가 없음). false = 필터 적용으로 0건. */
  isAbsoluteEmpty: boolean
  onResetFilter: () => void
}

/**
 * 이력 0건 상태.
 * - 절대 empty (등록 0건): hero CTA 강조 — DashboardEmptyState 와 유사하지만 짧게
 * - 필터 empty: 필터 초기화 버튼만
 */
export function HistoryEmptyState({
  isAbsoluteEmpty,
  onResetFilter,
}: HistoryEmptyStateProps): JSX.Element {
  if (isAbsoluteEmpty) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <h2 className="text-h2 text-text">아직 등록 이력이 없어요</h2>
          <p className="text-sm text-text-secondary">
            첫 상품을 등록하면 이곳에 진행 상태가 표시됩니다.
          </p>
          <Button asChild>
            <Link to="/register">첫 상품 등록 시작</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-text-secondary">조건에 맞는 등록 이력이 없습니다.</p>
        <Button variant="outline" onClick={onResetFilter}>
          필터 초기화
        </Button>
      </CardContent>
    </Card>
  )
}
