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
import { MARKET_IDS, MARKET_CATALOG } from '../types'

/**
 * MarketsConnectPage — n36 진입 (마켓 선택 → OAuth 시작 화면).
 * Stage C placeholder. Stage D 에서 v1 활성 마켓(naver) CTA 활성.
 *
 * v1 활성 = naver 1개 (2026-05-19 결정 — OQ-10). 나머지 4개는 status='coming_soon'.
 */
export function MarketsConnectPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        title="마켓 연결"
        subtitle="연결할 마켓을 선택하세요. v1 정식 = 네이버 스마트스토어 (쿠팡 · 11번가 · G마켓 · 옥션은 오픈 준비중)"
      />
      <div className="grid gap-3 md:grid-cols-2">
        {MARKET_IDS.map((id) => {
          const entry = MARKET_CATALOG[id]
          const isReady = entry.status === 'ready'
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle>{entry.label}</CardTitle>
                <CardDescription>
                  {isReady ? 'v1 지원' : '오픈 준비중 (v2 예정)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isReady ? (
                  <Button asChild variant="primary">
                    <Link to={`/markets/connect/${id}`}>연결 시작</Link>
                  </Button>
                ) : (
                  <Button disabled aria-disabled>
                    오픈 준비중
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default MarketsConnectPage
