import { Link, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  CardContent,
  ErrorMessage,
  Skeleton,
} from '@/components/ui'
import { useHistoryDetail } from '../hooks/useHistoryDetail'
import { HistoryDetailHeader } from '../components/HistoryDetailHeader'
import { HistoryErrorTabs } from '../components/HistoryErrorTabs'
import { HistoryRetryDialog } from '../components/HistoryRetryDialog'
import { HistoryExcludeDialog } from '../components/HistoryExcludeDialog'

/**
 * HistoryDetailPage — n43 / n44 (이력 상세 + 오류 분석).
 * 마스터: docs/architecture/v1/features/history.md §3.3.
 * 디자인 ref: docs/design-renewal/designFile/concepts/studio-empty.jsx (s6 detail).
 *
 * 구성:
 * - HistoryDetailHeader (breadcrumb + 메타 hero + 액션 슬롯)
 * - HistoryRetryDialog / HistoryExcludeDialog (헤더 액션)
 * - HistoryErrorTabs (결과 / 오류 분석 탭 + 마켓 카드 리스트)
 *
 * Realtime 2채널 구독은 useHistoryDetail 내부에서 처리.
 */
export function HistoryDetailPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()
  const { data, isLoading, isError, error } = useHistoryDetail(jobId)

  if (!jobId) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card>
          <CardContent className="py-6">
            <ErrorMessage tone="warning" message="유효하지 않은 잡 ID 입니다." />
            <div className="mt-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/history">← 이력 목록</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card>
          <CardContent className="py-6">
            <ErrorMessage
              tone="error"
              message="이력을 불러오지 못했습니다."
              {...(error instanceof Error ? { details: error.message } : {})}
            />
            <div className="mt-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/history">← 이력 목록</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <Card>
          <CardContent className="py-8 text-center text-sm text-text-secondary">
            잡을 찾을 수 없습니다. 삭제되었거나 본인 잡이 아닐 수 있습니다.
            <div className="mt-3">
              <Button asChild variant="ghost" size="sm">
                <Link to="/history">← 이력 목록</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <HistoryDetailHeader
        detail={data}
        actions={
          <>
            <HistoryRetryDialog jobId={jobId} detail={data} />
            <HistoryExcludeDialog jobId={jobId} detail={data} />
          </>
        }
      />

      <HistoryErrorTabs results={data.marketResults} />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to="/history">← 이력 목록</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">대시보드로</Link>
        </Button>
      </div>
    </div>
  )
}

export default HistoryDetailPage
