import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import type { MarketHealth } from '@/lib/schemas/dashboard-summary'

interface MarketHealthCardProps {
  state: 'loading' | 'data' | 'error'
  health?: MarketHealth
}

/**
 * 마켓 연결 건강 상태.
 * - active / expired / error / total 표시
 * - expired 또는 error ≥1 시 경고 + /markets 링크
 */
export function MarketHealthCard({ state, health }: MarketHealthCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>마켓 연결 상태</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === 'loading' ? (
          <div className="space-y-2" role="status" aria-label="마켓 연결 상태 불러오는 중">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : state === 'error' ? (
          <p className="text-sm text-danger" role="alert">
            마켓 연결 상태를 불러오지 못했습니다.
          </p>
        ) : !health || health.total === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">아직 연결된 마켓이 없어요.</p>
            <Link
              to="/markets"
              className="inline-flex items-center text-sm font-medium text-accent hover:underline"
            >
              마켓 연결하기 →
            </Link>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-xs text-text-secondary">정상</dt>
                <dd className="mt-1 text-xl font-bold text-success-on-soft">{health.active}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">만료</dt>
                <dd className="mt-1 text-xl font-bold text-warning-on-soft">{health.expired}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">오류</dt>
                <dd className="mt-1 text-xl font-bold text-danger-on-soft">{health.error}</dd>
              </div>
            </dl>
            {health.expired + health.error > 0 ? (
              <div
                className="rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2 text-xs text-warning-on-soft"
                role="status"
              >
                <p>
                  {health.expired > 0
                    ? `토큰이 만료된 마켓이 ${health.expired}개 있습니다. `
                    : ''}
                  {health.error > 0 ? `오류 상태의 마켓이 ${health.error}개 있습니다. ` : ''}
                  <Link to="/markets" className="font-medium underline">
                    마켓 페이지에서 재연결
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">모든 마켓이 정상 연결됨</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
