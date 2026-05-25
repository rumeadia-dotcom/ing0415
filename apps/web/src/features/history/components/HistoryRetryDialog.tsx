import { useState } from 'react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui'
import { useRegistrationRetry } from '@/features/registration/hooks/useRegistrationRetry'
import { RegistrationApiError } from '@/features/registration/api/registration-api'
import { formatRegistrationError } from '@/features/registration/utils/registration-error-messages'
import { MARKET_CATALOG } from '@/features/markets/types'
import type { JobDetail } from '@/lib/schemas/history-filter'

interface HistoryRetryDialogProps {
  jobId: string
  detail: JobDetail
  /** disabled = partial/failed 이외 상태에서 트리거 자체를 막는 외부 가드. */
  disabled?: boolean
}

/**
 * 재시도 액션 (Dialog confirm).
 * 마스터: docs/architecture/v1/features/history.md §3.3 + registration.md §6.5
 *
 * 정책:
 * - 잡 status 가 `partial` 또는 `failed` 일 때만 활성화. 그 외는 disabled.
 * - 재시도 대상 = failed 상태 + excluded=false 인 마켓 결과들.
 * - 대상 0건이면 toast.info 후 다이얼로그 닫음.
 * - 본 컴포넌트는 "재시도 전체" 만 지원. 마켓별 단건 재시도는 v2.
 */
export function HistoryRetryDialog({
  jobId,
  detail,
  disabled,
}: HistoryRetryDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const retry = useRegistrationRetry()

  const retriable = detail.marketResults.filter(
    (r) => r.marketStatus === 'failed' && !r.excluded,
  )
  const canTrigger =
    !disabled &&
    (detail.job.status === 'partial' || detail.job.status === 'failed')

  const handleConfirm = (): void => {
    if (retriable.length === 0) {
      toast.info('재시도 가능한 마켓이 없습니다.')
      setOpen(false)
      return
    }
    retry.mutate(
      { jobId, marketResultIds: retriable.map((r) => r.id) },
      {
        onSuccess: () => {
          toast.success(`${retriable.length}개 마켓 재시도 시작`)
          setOpen(false)
        },
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canTrigger}
        >
          재시도
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>실패한 마켓 재시도</DialogTitle>
          <DialogDescription>
            다음 마켓에 대해 재시도를 수행합니다. 마켓 API 가 일시 장애 상태였다면 성공할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {retriable.length === 0 ? (
          <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-secondary">
            재시도 가능한 마켓이 없습니다 (최종 실패 / 제외된 마켓만 존재).
          </p>
        ) : (
          <ul className="grid gap-1.5 rounded-md border border-border bg-surface-muted/40 p-2 text-sm text-text">
            {retriable.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded px-2 py-1.5"
              >
                <span className="font-medium">
                  {MARKET_CATALOG[r.marketId].label}
                </span>
                <span className="font-mono text-xs text-text-tertiary tabular-nums">
                  시도 {r.attemptCount} / 3회
                </span>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={retry.isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={retry.isPending || retriable.length === 0}
          >
            {retry.isPending ? '재시도 중…' : '재시도 시작'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
