import { Link } from 'react-router-dom'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'

/**
 * NotFoundPage — catch-all (404).
 * GitHub Pages 의 404.html fallback 으로 진입한 잘못된 URL 도 여기로 안내.
 */
export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle px-4 py-10">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle>404 — 페이지를 찾을 수 없습니다</CardTitle>
          <CardDescription>요청하신 주소를 찾지 못했습니다. URL 을 다시 확인하세요.</CardDescription>
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

export default NotFoundPage
