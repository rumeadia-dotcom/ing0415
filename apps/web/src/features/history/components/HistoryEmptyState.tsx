import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

interface HistoryEmptyStateProps {
  /** true = 필터가 모두 디폴트인데 0건 (등록 자체가 없음). false = 필터 적용으로 0건. */
  isAbsoluteEmpty: boolean
  onResetFilter: () => void
}

/**
 * 이력 0건 상태 — Studio 카드 셸.
 * - 절대 empty (등록 0건): hero CTA 강조
 * - 필터 empty: 필터 초기화 버튼만
 */
export function HistoryEmptyState({
  isAbsoluteEmpty,
  onResetFilter,
}: HistoryEmptyStateProps): JSX.Element {
  if (isAbsoluteEmpty) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="text-h2 text-text">아직 등록 이력이 없어요</h2>
        <p className="max-w-md text-sm text-text-secondary">
          첫 상품을 등록하면 이곳에 진행 상태와 마켓별 결과가 표시됩니다.
        </p>
        <Button asChild className="mt-2">
          <Link to="/register">첫 상품 등록 시작</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center">
      <p className="text-sm text-text-secondary">
        조건에 맞는 등록 이력이 없습니다.
      </p>
      <Button variant="outline" onClick={onResetFilter} size="sm">
        필터 초기화
      </Button>
    </section>
  )
}
