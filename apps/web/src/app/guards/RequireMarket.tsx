import { Navigate, Outlet } from 'react-router-dom'
import { useMarketAccounts } from '@/features/markets/hooks/useMarketAccounts'
import { Skeleton } from '@/components/ui'

/**
 * 마켓 계정 연동 가드.
 * active 상태 계정이 1개 이상 없으면 /markets 로 리다이렉트.
 * 로딩 중에는 skeleton 표시 (플리커 방지).
 */
export function RequireMarket(): JSX.Element {
  const { data: accounts, isLoading } = useMarketAccounts()

  if (isLoading) {
    return (
      <div className="space-y-3 p-6" role="status" aria-label="로딩 중">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const hasActiveMarket = (accounts ?? []).some((a) => a.status === 'active')
  if (!hasActiveMarket) {
    return <Navigate to="/markets" replace />
  }

  return <Outlet />
}
