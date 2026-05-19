import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Skeleton } from '@/components/ui'

/**
 * RequireAuth — auth.md §6.1 (부트스트랩) + frontend.md §2.1 가드 패턴.
 *
 * - status === 'loading' → 짧은 스켈레톤 (storage hydrate)
 * - status === 'anonymous' → /login 으로 리다이렉트 + 원 위치 보존 (state.from)
 * - status === 'authed' → 자식 라우트 렌더
 *
 * 사용: 라우트 트리에서 보호하고자 하는 그룹의 `element` 로 지정.
 */
export function RequireAuth(): JSX.Element {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="세션을 확인하는 중"
        className="space-y-3 p-6"
      >
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  return <Outlet />
}
