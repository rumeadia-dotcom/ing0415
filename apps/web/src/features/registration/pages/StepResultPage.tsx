import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorMessage,
  Skeleton,
} from '@/components/ui'
import { useRegistrationJob } from '../hooks/useRegistrationJob'
import { useRegistrationRetry } from '../hooks/useRegistrationRetry'
import { useRegistrationStart } from '../hooks/useRegistrationStart'
import { JobProgressBar } from '../components/JobProgressBar'
import { JobMarketResultRow } from '../components/JobMarketResultRow'
import { PartialJobBanner } from '../components/PartialJobBanner'
import { RegistrationApiError } from '../api/registration-api'
import { formatRegistrationError } from '../utils/registration-error-messages'
import { useRegisterFormStore } from '../store/useRegisterFormStore'

/**
 * StepResultPage — n21 / n24 / n25 (5/5).
 * 마스터: docs/architecture/v1/features/registration.md §10.7
 *
 * - useRegistrationJob: useQuery + Realtime (2채널).
 * - 상위 status terminal 진입 시 refetchInterval 자동 정지.
 * - partial: PartialJobBanner + 마켓별 재시도 / 실패 마켓 제외 후 재등록.
 */
export function StepResultPage(): JSX.Element {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useRegistrationJob(jobId ?? '')
  const retry = useRegistrationRetry()
  const start = useRegistrationStart()
  const productId = useRegisterFormStore((s) => s.productId)

  if (!jobId) {
    return (
      <div className="mx-auto w-full max-w-[960px]">
        <PageHeader title="등록 결과" subtitle="유효하지 않은 잡 ID 입니다" />
        <Card>
          <CardContent className="py-6">
            <Button asChild variant="ghost">
              <Link to="/history">이력으로</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleRetryAll = (): void => {
    retry.mutate(
      { jobId },
      {
        onError: (e) => {
          const f = e instanceof RegistrationApiError ? formatRegistrationError(e) : { message: '재시도에 실패했습니다.', correlationId: null }
          toast.error(f.message)
        },
      },
    )
  }

  const handleRetryOne = (resultId: string): void => {
    retry.mutate(
      { jobId, marketResultIds: [resultId] },
      {
        onError: (e) => {
          const f = e instanceof RegistrationApiError ? formatRegistrationError(e) : { message: '재시도에 실패했습니다.', correlationId: null }
          toast.error(f.message)
        },
      },
    )
  }

  const handleExcludeAndRestart = (): void => {
    if (!data || !productId) return
    const successMarkets = data.results.filter((r) => r.marketStatus === 'success').map((r) => r.marketId)
    const targetMarkets = data.results
      .filter((r) => r.marketStatus !== 'success' && r.marketStatus !== 'failed_final')
      .map((r) => r.marketId)
    if (targetMarkets.length === 0) {
      toast.info('재등록 가능한 마켓이 없습니다.')
      return
    }
    start.mutate(
      { productId, marketIds: targetMarkets, parentJobId: jobId },
      {
        onSuccess: (resp) => {
          toast.success(`${targetMarkets.length}개 마켓 재등록 시작 (성공 ${successMarkets.length}개 유지)`)
          navigate(`/register/result/${resp.jobId}`, { replace: true })
        },
        onError: (e) => {
          const f = e instanceof RegistrationApiError ? formatRegistrationError(e) : { message: '재등록을 시작할 수 없습니다.', correlationId: null }
          toast.error(f.message)
        },
      },
    )
  }

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <PageHeader title="등록 결과" subtitle={`Job ID: ${jobId}`} />

      {isLoading && (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}
      {isError && (
        <Card>
          <CardContent className="py-6">
            <ErrorMessage
              message={
                error instanceof RegistrationApiError
                  ? formatRegistrationError(error).message
                  : '잡 정보를 불러오지 못했습니다.'
              }
            />
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>진행률</CardTitle>
            </CardHeader>
            <CardContent>
              <JobProgressBar status={data.job.status} results={data.results} />
            </CardContent>
          </Card>

          {data.job.status === 'partial' && (
            <div className="mb-4">
              <PartialJobBanner
                results={data.results}
                onRetryAll={handleRetryAll}
                onExcludeAndRestart={handleExcludeAndRestart}
                retryAllPending={retry.isPending}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>마켓별 결과</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.results.map((r) => (
                  <JobMarketResultRow
                    key={r.id}
                    result={r}
                    onRetry={handleRetryOne}
                    retrying={retry.isPending}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/history">등록 이력으로</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/dashboard">대시보드로</Link>
        </Button>
      </div>
    </div>
  )
}

export default StepResultPage
