import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { MARKET_IDS, MARKET_LABEL, type MarketId } from '../types'

/**
 * MarketsConnectProviderPage — n36 (특정 provider OAuth 시작).
 * Stage C placeholder. Stage D 에서 startOAuth mutation → window.location.href 이동.
 *
 * URL provider 검증은 Stage D 에서 zod enum 으로 정식화. 현재는 단순 includes 체크.
 */
function isMarketId(value: string | undefined): value is MarketId {
  return typeof value === 'string' && (MARKET_IDS as readonly string[]).includes(value)
}

export function MarketsConnectProviderPage(): JSX.Element {
  const { provider } = useParams<{ provider: string }>()
  const valid = isMarketId(provider)
  const label = valid ? MARKET_LABEL[provider] : '알 수 없는 마켓'

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title={`${label} 연결`} subtitle="OAuth 인증으로 마켓 계정을 연결합니다" />
      <Card>
        <CardHeader>
          <CardTitle>OAuth 시작 — 준비 중</CardTitle>
          <CardDescription>
            {valid
              ? '버튼을 누르면 마켓 인증 화면으로 이동합니다 (Stage D 에서 활성화).'
              : '유효하지 않은 마켓 provider 입니다.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild variant="ghost">
            <Link to="/markets/connect">목록으로</Link>
          </Button>
          <Button disabled aria-disabled>
            {valid ? `${label} 로 이동 (Stage D)` : '진행 불가'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default MarketsConnectProviderPage
