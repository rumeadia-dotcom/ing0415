import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { useRegistrationStart } from '@/features/registration/hooks/useRegistrationStart'
import { RegistrationApiError } from '@/features/registration/api/registration-api'
import { formatRegistrationError } from '@/features/registration/utils/registration-error-messages'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { JobDetail } from '@/lib/schemas/history-filter'
import { ko } from '@/locales/ko'

interface HistoryExcludeDialogProps {
  jobId: string
  detail: JobDetail
  disabled?: boolean
}

/**
 * 마켓 제외 후 재등록 액션.
 * 마스터: docs/architecture/v1/features/history.md §3.3 + registration.md §6.3 (parentJobId)
 *
 * 정책:
 * - 잡 status 가 `partial` 또는 `failed` 일 때만 활성. (성공 마켓 유지하고 실패 마켓만 재시도하는 의미)
 * - 후보 마켓 = 실패한(failed / failed_final) 마켓.
 * - 사용자가 "재등록할" 마켓을 체크박스로 선택. 1개 이상 강제.
 * - 새 잡 ID 응답 → `/history/:newJobId` 로 navigate.
 *
 * 본 다이얼로그는 "성공 마켓은 그대로 유지, 선택한 실패 마켓만 재등록" 의미.
 * registration-start 에 parentJobId 전달하면 백엔드가 partial 재등록 잡으로 인식.
 */
export function HistoryExcludeDialog({
  jobId,
  detail,
  disabled,
}: HistoryExcludeDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const start = useRegistrationStart()
  const navigate = useNavigate()

  const candidates = useMemo(
    () =>
      detail.marketResults.filter(
        (r) => r.marketStatus === 'failed' || r.marketStatus === 'failed_final',
      ),
    [detail.marketResults],
  )

  const successCount = detail.marketResults.filter(
    (r) => r.marketStatus === 'success',
  ).length

  const [selected, setSelected] = useState<Set<MarketId>>(
    () => new Set(candidates.map((r) => r.marketId)),
  )

  const canTrigger =
    !disabled &&
    (detail.job.status === 'partial' || detail.job.status === 'failed') &&
    candidates.length > 0

  const handleOpenChange = (next: boolean): void => {
    if (next) {
      setSelected(new Set(candidates.map((r) => r.marketId)))
    }
    setOpen(next)
  }

  const toggle = (id: MarketId): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = (): void => {
    const targets = Array.from(selected)
    if (targets.length === 0) {
      toast.error(ko.commonToasts.selectAtLeastOneMarket)
      return
    }
    start.mutate(
      { productId: detail.product.id, marketIds: targets, parentJobId: jobId },
      {
        onSuccess: (resp) => {
          toast.success(
            `${targets.length}개 마켓 재등록 시작 (성공 ${successCount}개 유지)`,
          )
          setOpen(false)
          navigate(`/history/${resp.jobId}`)
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canTrigger}
        onClick={() => handleOpenChange(true)}
      >
        실패 마켓만 재등록
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>실패 마켓만 재등록</DialogTitle>
          <DialogDescription>
            이미 성공한 마켓({successCount}개)은 그대로 두고, 선택한 실패 마켓에 대해서만 새 등록 잡을 시작합니다.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-secondary">
            재등록 대상 실패 마켓이 없습니다.
          </p>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="sr-only">재등록할 마켓 선택</legend>
            {candidates.map((r) => {
              const id = `exclude-${r.marketId}`
              const isFinal = r.marketStatus === 'failed_final'
              return (
                <label
                  key={r.id}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-sm hover:bg-surface-muted"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.has(r.marketId)}
                    onChange={() => toggle(r.marketId)}
                    className="h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="flex-1 font-medium text-text">
                    {MARKET_CATALOG[r.marketId].label}
                  </span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${
                      isFinal
                        ? 'bg-danger-soft text-danger-on-soft'
                        : 'bg-warning-soft text-warning-on-soft'
                    }`}
                  >
                    {isFinal ? '최종 실패' : '실패'}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={start.isPending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              start.isPending || candidates.length === 0 || selected.size === 0
            }
          >
            {start.isPending ? '시작 중…' : '재등록 시작'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
