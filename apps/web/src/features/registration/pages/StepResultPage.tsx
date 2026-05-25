import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, ErrorMessage, Skeleton } from '@/components/ui'
import { useRegistrationJob } from '../hooks/useRegistrationJob'
import { useRegistrationRetry } from '../hooks/useRegistrationRetry'
import { useRegistrationStart } from '../hooks/useRegistrationStart'
import { JobProgressBar } from '../components/JobProgressBar'
import { JobMarketResultRow } from '../components/JobMarketResultRow'
import { PartialJobBanner } from '../components/PartialJobBanner'
import { RegistrationApiError } from '../api/registration-api'
import { formatRegistrationError } from '../utils/registration-error-messages'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { ko } from '@/locales/ko'

/**
 * StepResultPage — n21 / n24 / n25 (5/5). Studio 룩.
 * 마스터: docs/architecture/v1/features/registration.md §10.7 · studio-register.jsx step5
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
      <div className="mx-auto w-full max-w-[1080px]">
        <PageHeader title="등록 결과" subtitle="유효하지 않은 잡 ID 입니다" />
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Button asChild variant="ghost" className="border border-border">
            <Link to="/history">이력으로</Link>
          </Button>
        </div>
      </div>
    )
  }

  const handleRetryAll = (): void => {
    retry.mutate(
      { jobId },
      {
        onError: (e) => {
          const f =
            e instanceof RegistrationApiError
              ? formatRegistrationError(e)
              : { message: '재시도에 실패했습니다.', correlationId: null }
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
          const f =
            e instanceof RegistrationApiError
              ? formatRegistrationError(e)
              : { message: '재시도에 실패했습니다.', correlationId: null }
          toast.error(f.message)
        },
      },
    )
  }

  const handleExcludeAndRestart = (): void => {
    if (!data || !productId) return
    const successMarkets = data.results
      .filter((r) => r.marketStatus === 'success')
      .map((r) => r.marketId)
    const targetMarkets = data.results
      .filter((r) => r.marketStatus !== 'success' && r.marketStatus !== 'failed_final')
      .map((r) => r.marketId)
    if (targetMarkets.length === 0) {
      toast.info(ko.commonToasts.noRestartableMarkets)
      return
    }
    start.mutate(
      { productId, marketIds: targetMarkets, parentJobId: jobId },
      {
        onSuccess: (resp) => {
          toast.success(
            `${targetMarkets.length}개 마켓 재등록 시작 (성공 ${successMarkets.length}개 유지)`,
          )
          navigate(`/register/result/${resp.jobId}`, { replace: true })
        },
        onError: (e) => {
          const f =
            e instanceof RegistrationApiError
              ? formatRegistrationError(e)
              : { message: '재등록을 시작할 수 없습니다.', correlationId: null }
          toast.error(f.message)
        },
      },
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader
        title="등록 결과"
        subtitle={
          data
            ? `${data.results.filter((r) => r.marketStatus === 'success').length}/${data.results.length}개 마켓 처리됨 · Job ${jobId.slice(0, 8)}`
            : `Job ${jobId.slice(0, 8)}`
        }
      />
      {/* 4-state */}
      {isLoading && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <ErrorMessage
            message={
              error instanceof RegistrationApiError
                ? formatRegistrationError(error).message
                : '잡 정보를 불러오지 못했습니다.'
            }
          />
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          {/* Hero — 진행률 KPI + (partial 일 때) 우측 액션 카드 */}
          <div
            className={
              data.job.status === 'partial'
                ? 'grid gap-4 lg:grid-cols-[1fr_280px]'
                : 'grid gap-4'
            }
          >
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-bold text-text">진행률</h2>
                <span className="font-mono text-[11.5px] text-text-tertiary">
                  Job · {jobId.slice(0, 8)}
                </span>
              </header>
              <JobProgressBar status={data.job.status} results={data.results} />
            </section>

            {data.job.status === 'partial' && (
              <PartialJobBanner
                results={data.results}
                onRetryAll={handleRetryAll}
                onExcludeAndRestart={handleExcludeAndRestart}
                retryAllPending={retry.isPending}
              />
            )}
          </div>

          {/* 마켓별 결과 */}
          <section className="rounded-xl border border-border bg-surface shadow-sm">
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-[14px] font-bold text-text">마켓별 결과</h2>
              <span className="text-[11.5px] text-text-tertiary">
                총 {data.results.length}개 마켓
              </span>
            </header>
            {data.results.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-text-tertiary">
                결과가 아직 없습니다.
              </div>
            ) : (
              <ul className="space-y-2 p-3">
                {data.results.map((r) => (
                  <JobMarketResultRow
                    key={r.id}
                    result={r}
                    onRetry={handleRetryOne}
                    retrying={retry.isPending}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* 실패 분석 */}
          {data.job.status === 'partial' && data.results.some((r) => r.errorCode) && (
            <aside className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
              <p className="text-[12.5px] text-text-secondary">
                <span className="font-bold text-danger-on-soft">실패 분석:</span> 실패 코드별 가이드는
                각 마켓 행의 오류 코드를 참고하세요. 상품 정보 수정 후 마켓 제외 재등록을 권장합니다.
              </p>
            </aside>
          )}

          {/* Footer CTAs */}
          <div className="mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 shadow-sm">
            <Button asChild variant="ghost" className="border border-border">
              <Link to="/history">등록 이력으로</Link>
            </Button>
            <Button asChild variant="primary" className="ml-auto">
              <Link to="/dashboard">대시보드로 →</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StepResultPage
