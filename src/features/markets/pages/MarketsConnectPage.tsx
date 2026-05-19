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
import { MARKET_IDS, MARKET_LABEL } from '../types'

/**
 * MarketsConnectPage — n36 진입 (마켓 선택 → OAuth 시작 화면).
 * Stage C placeholder. Stage D 에서 v1 활성 마켓(naver/coupang) 만 CTA 활성.
 */
export function MarketsConnectPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        title="마켓 연결"
        subtitle="연결할 마켓을 선택하세요. v1 우선 = 네이버 스마트스토어 + 쿠팡"
      />
      <div className="grid gap-3 md:grid-cols-2">
        {MARKET_IDS.map((id) => {
          const isMvp = id === 'naver' || id === 'coupang'
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle>{MARKET_LABEL[id]}</CardTitle>
                <CardDescription>
                  {isMvp ? 'v1 지원' : 'v2 예정 (어댑터만 구현, OAuth 미구현)'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isMvp ? (
                  <Button asChild variant="primary">
                    <Link to={`/markets/connect/${id}`}>연결 시작</Link>
                  </Button>
                ) : (
                  <Button disabled aria-disabled>
                    v2 예정
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
