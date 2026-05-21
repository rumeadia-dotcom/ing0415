import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import type { MarketResult } from '@/lib/schemas/registration'

interface PartialJobBannerProps {
  results: MarketResult[]
  onRetryAll: () => void
  onExcludeAndRestart: () => void
  retryAllPending?: boolean
}

/**
 * partial 상태 시각화 + 액션 2종 (전체 재시도 / 실패 마켓 제외 후 재등록). Studio 룩.
 * 마스터: docs/architecture/v1/features/registration.md §11.1
 */
export function PartialJobBanner({
  results,
  onRetryAll,
  onExcludeAndRestart,
  retryAllPending,
}: PartialJobBannerProps): JSX.Element {
  const failed = results.filter(
    (r) => r.marketStatus === 'failed' || r.marketStatus === 'failed_final',
  )
  const success = results.filter((r) => r.marketStatus === 'success')

  return (
    <section className="rounded-xl border-[1.5px] border-warning/30 bg-warning-soft p-5">
      <header className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-white"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-[14px] font-bold text-text">일부 마켓 등록이 실패했습니다</h3>
      </header>
      <p className="mb-3 text-[12.5px] text-text-secondary">
        성공 <span className="font-mono font-semibold">{success.length}</span> · 실패{' '}
        <span className="font-mono font-semibold">{failed.length}</span> · 실패한 마켓만 재시도하거나
        제외하고 새 잡으로 재등록할 수 있어요.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={onRetryAll}
          disabled={retryAllPending || failed.length === 0}
        >
          {retryAllPending ? '재시도 중…' : `전체 재시도 (${failed.length}개)`}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onExcludeAndRestart}
        >
          실패 마켓 제외 후 재등록
        </Button>
      </div>
    </section>
  )
}
