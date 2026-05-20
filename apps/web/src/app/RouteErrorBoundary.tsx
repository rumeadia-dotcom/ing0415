import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'

/**
 * RouteErrorBoundary — React Router v6 errorElement.
 * frontend.md §11.2.
 *
 * Stage C 는 Sentry 통합 없이 시각만. Stage D 에서 Sentry.captureException + beforeSend 마스킹.
 */
export function RouteErrorBoundary(): JSX.Element {
  const error = useRouteError()

  let title = '예상치 못한 오류가 발생했습니다'
  let detail = '잠시 후 다시 시도하거나 대시보드로 돌아가세요.'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    detail = typeof error.data === 'string' ? error.data : JSON.stringify(error.data ?? '')
  } else if (error instanceof Error) {
    detail = error.message
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-10">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{detail}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="primary">
            <Link to="/dashboard">대시보드로</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/login">로그인으로</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default RouteErrorBoundary
