import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { isDev } from '@/lib/env'

const STALE_CHUNK_RELOAD_KEY = 'stale_chunk_reloaded'

function isStaleChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('dynamically imported module') ||
    error.message.includes('Failed to fetch') ||
    error.name === 'ChunkLoadError'
  )
}

/**
 * RouteErrorBoundary — React Router v6 errorElement.
 * frontend.md §11.2.
 *
stale chunk 감지: 배포 후 청크 해시가 바뀌어 이전 모듈 URL이 404가 되는 경우
 * sessionStorage 플래그로 무한 새로고침을 방지하며 1회 자동 reload.
 *
 * Sentry 통합 (cycle 36): stale chunk 가 아닌 진짜 에러만 Sentry.captureException 호출.
 * beforeSend 가 redact() 로 PII 마스킹 수행.
 */
export function RouteErrorBoundary(): JSX.Element {
  const error = useRouteError()
  const stale = isStaleChunkError(error)

  useEffect(() => {
    if (!stale) return
    const alreadyReloaded = sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)
    if (alreadyReloaded) return
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  }, [stale])

  // stale chunk 가 아니면 Sentry 로 송출 (initSentry 가 안 된 경우 no-op).
  useEffect(() => {
    if (stale) return
    if (error == null) return
    try {
      Sentry.captureException(error)
    } catch {
      // Sentry 미초기화 시 throw — 무시.
    }
  }, [error, stale])

  if (stale) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-10">
        <Card className="w-full max-w-[480px]">
          <CardHeader>
            <CardTitle>새 버전이 배포되었습니다</CardTitle>
            <CardDescription>
              페이지를 새로고침하면 최신 버전으로 이동합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY)
                window.location.reload()
              }}
            >
              지금 새로고침
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  let title = '예상치 못한 오류가 발생했습니다'
  let detail = '잠시 후 다시 시도하거나 대시보드로 돌아가세요.'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    detail = typeof error.data === 'string' ? error.data : JSON.stringify(error.data ?? '')
  } else if (error instanceof Error && isDev) {
    // 운영 환경에서는 internal error.message 를 사용자에게 노출하지 않음 (stack/PII 유출 방지).
    // dev 모드에서만 디버그 편의 위해 노출.
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
