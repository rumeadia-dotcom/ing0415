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
 * StepResultPage — n21 등록 결과.
 * Stage C placeholder. Stage E 에서 Realtime 구독 + 마켓별 결과 카드 + partial 처리.
 *
 * RegisterLayout(스테퍼) 바깥 라우트 — 결과 화면은 5단계 위저드 종료 후 상태.
 */
export function StepResultPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader
        title="등록 결과"
        subtitle={jobId ? `Job ID: ${jobId}` : '등록 작업 결과'}
      />
      <Card>
        <CardHeader>
          <CardTitle>등록 결과 — 준비 중</CardTitle>
          <CardDescription>
            마켓별 성공/실패 카드, partial 시 실패 마켓만 재시도 CTA, Realtime 진행 표시가
            이 영역에 구현됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-secondary">
            Stage E 에서 RegistrationJob 실시간 구독과 함께 활성화됩니다.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/history">등록 이력으로</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/dashboard">대시보드로</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default StepResultPage
