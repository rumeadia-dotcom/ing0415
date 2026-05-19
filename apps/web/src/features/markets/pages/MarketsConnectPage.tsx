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
import { ko } from '@/locales/ko'
import { MARKET_IDS, MARKET_CATALOG } from '../types'

/**
 * MarketsConnectPage — n36 진입 (마켓 선택 → 4-way 인증 분기).
 *
 * Wave 3 (2026-05-19 5마켓 MVP 확장):
 *  - v1 활성 4개 (naver / coupang / gmarket / auction) = `[연결 시작]` CTA
 *  - 11번가만 status='coming_soon' = disabled
 *
 * Stage D 에서 connect 클릭이 실제 mutation 으로 연결. 현재는 라우팅만.
 */
export function MarketsConnectPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        title="마켓 연결"
        subtitle="연결할 마켓을 선택하세요. v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 4종. 11번가는 오픈 준비중."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {MARKET_IDS.map((id) => {
          const entry = MARKET_CATALOG[id]
          const isReady = entry.status === 'ready'
          const authHint =
            entry.authMode === 'oauth'
              ? 'OAuth 2.0 인증 (마켓 로그인 페이지로 이동)'
              : entry.authMode === 'hmac'
                ? 'API 키 입력 (Access / Secret / Vendor ID)'
                : entry.authMode === 'esm_jwt'
                  ? 'ESM 키 입력 (Master ID / Secret / Seller ID)'
                  : ko.marketStatus.coming_soon
          return (
            <Card key={id}>
              <CardHeader>
                <CardTitle>{entry.label}</CardTitle>
                <CardDescription>
                  {isReady ? authHint : `${ko.marketStatus.coming_soon} (v2 예정)`}
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
