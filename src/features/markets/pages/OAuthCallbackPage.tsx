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

/**
 * OAuthCallbackPage — n37 OAuth 콜백 처리.
 * Stage C placeholder. Stage F 에서 search params (code, state) 검증 + completeOAuth mutation.
 *
 * 라우트: /markets/callback/:provider
 * (frontend.md §2.3 표는 /markets/oauth/callback 이지만 본 라우터는 짧은 /markets/callback 사용 —
 *  Stage F 에서 통일성 재검토 필요)
 */
export function OAuthCallbackPage(): JSX.Element {
  const { provider } = useParams<{ provider: string }>()

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader
        title="OAuth 콜백 처리"
        subtitle={provider ? `${provider} 인증 결과를 처리 중입니다` : 'OAuth 결과 처리 중'}
      />
      <Card>
        <CardHeader>
          <CardTitle>OAuth 콜백 — 준비 중</CardTitle>
          <CardDescription>
            마켓 인증 후 리다이렉트되는 화면. code/state 검증 + Edge Function 호출 + 토큰 저장이
            여기서 일어납니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="ghost">
            <Link to="/markets">마켓 목록으로</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default OAuthCallbackPage
