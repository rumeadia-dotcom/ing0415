import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'

/**
 * MarketsListPage — n34 / n35 (연결된 마켓 계정 목록).
 * Stage C placeholder. Stage D 에서 useMarketAccounts + 4상태 처리 + Realtime.
 */
export function MarketsListPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageHeader
        title="마켓 계정"
        subtitle="연결된 마켓을 관리하고 새 마켓을 연결합니다"
        actions={
          <Button asChild variant="primary">
            <Link to="/markets/connect">마켓 연결</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>마켓 목록 — 준비 중</CardTitle>
          <CardDescription>
            연결된 마켓 카드 그리드 (loading / data / error / empty 4상태) 가 여기에 구현됩니다.
            v1 정식 = 네이버 스마트스토어. 쿠팡 · 11번가 · G마켓 · 옥션은 오픈 준비중 (2026-05-19 결정 — OQ-10).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-secondary">
            Stage D 에서 Supabase market_accounts 조회와 함께 활성화됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default MarketsListPage
