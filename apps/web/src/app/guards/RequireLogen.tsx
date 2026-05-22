import { Navigate, Outlet } from 'react-router-dom'
import { useLogenCredentialsStatus } from '@/features/settings/shipping/hooks/useLogenCredentialsStatus'
import { Skeleton } from '@/components/ui'

/**
 * 로젠택배 API 연동 가드.
 * hasCredentials=false 이면 /settings/shipping 으로 리다이렉트.
 * 로딩 중에는 skeleton 표시 (플리커 방지).
 */
export function RequireLogen(): JSX.Element {
  const { data: status, isLoading } = useLogenCredentialsStatus()

  if (isLoading) {
    return (
      <div className="space-y-3 p-6" role="status" aria-label="로딩 중">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!status?.hasCredentials) {
    return <Navigate to="/settings/shipping" replace />
  }

  return <Outlet />
}
