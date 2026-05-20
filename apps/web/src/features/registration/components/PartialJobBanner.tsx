import { Button, Card, CardContent } from '@/components/ui'
import type { MarketResult } from '@/lib/schemas/registration'

interface PartialJobBannerProps {
  results: MarketResult[]
  onRetryAll: () => void
  onExcludeAndRestart: () => void
  retryAllPending?: boolean
}

/**
 * partial 상태 시각화 + 액션 2종 (전체 재시도 / 실패 마켓 제외 후 재등록).
 * 마스터: docs/architecture/v1/features/registration.md §11.1
 */
export function PartialJobBanner({ results, onRetryAll, onExcludeAndRestart, retryAllPending }: PartialJobBannerProps): JSX.Element {
  const failed = results.filter((r) => r.marketStatus === 'failed' || r.marketStatus === 'failed_final')
  const success = results.filter((r) => r.marketStatus === 'success')

  return (
    <Card className="border-warning/40 bg-warning-soft">
      <CardContent className="space-y-2 py-3 text-sm text-warning-on-soft">
        <p className="font-medium">
          일부 마켓 등록이 실패했습니다 — 성공 {success.length} · 실패 {failed.length}
        </p>
        <p className="text-xs">
          전체 재시도(실패한 모든 마켓) 또는 실패 마켓을 제외하고 성공한 마켓만 유지할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onRetryAll}
            disabled={retryAllPending || failed.length === 0}
          >
            {retryAllPending ? '재시도 중…' : `전체 재시도 (${failed.length}개)`}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onExcludeAndRestart}>
            실패 마켓 제외 후 재등록
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
