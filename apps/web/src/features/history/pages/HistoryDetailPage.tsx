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
 * HistoryDetailPage — n43 / n44 (이력 상세 + 오류 분석).
 * Stage C placeholder. Stage E 에서 useRegistrationJob + Realtime + partial 처리.
 */
export function HistoryDetailPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        title="등록 이력 상세"
        subtitle={jobId ? `Job ID: ${jobId}` : '등록 잡 상세'}
      />
      <Card>
        <CardHeader>
          <CardTitle>이력 상세 — 준비 중</CardTitle>
          <CardDescription>
            마켓별 결과 카드 / 오류 분석 / raw error 접힘 / 재시도 액션이 여기에 구현됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="ghost">
            <Link to="/history">목록으로</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default HistoryDetailPage
