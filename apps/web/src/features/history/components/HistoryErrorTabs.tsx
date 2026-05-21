import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import type { JobMarketResult } from '@/lib/schemas/history-filter'
import { HistoryMarketResultCard } from './HistoryMarketResultCard'

interface HistoryErrorTabsProps {
  results: JobMarketResult[]
}

/**
 * 결과 / 에러 탭 — n44.
 * - 결과: 모든 마켓 결과 카드
 * - 에러: failed / failed_final 만 모아서 표시 (탭 trigger 에 danger 카운트 뱃지)
 *
 * failed 가 0건이면 '에러' 탭 자체를 노출하지 않음.
 * 마스터: docs/architecture/v1/features/history.md §3.3 / n44.
 * 디자인 ref: docs/design-renewal/designFile/concepts/studio-empty.jsx (s6 detail tabs).
 */
export function HistoryErrorTabs({ results }: HistoryErrorTabsProps): JSX.Element {
  const failed = results.filter(
    (r) => r.marketStatus === 'failed' || r.marketStatus === 'failed_final',
  )
  const hasErrors = failed.length > 0

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList>
        <TabsTrigger value="all">
          <span>결과</span>
          <span className="ml-1.5 font-mono text-[11px] text-text-tertiary tabular-nums">
            {results.length}
          </span>
        </TabsTrigger>
        {hasErrors ? (
          <TabsTrigger value="errors">
            <span>오류 분석</span>
            <span
              aria-label={`오류 ${failed.length}건`}
              className="ml-1.5 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-danger px-1.5 font-mono text-[10px] font-bold text-white tabular-nums"
            >
              {failed.length}
            </span>
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="all">
        {results.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-tertiary">
            마켓 결과가 아직 없습니다.
          </p>
        ) : (
          <ul className="grid gap-3">
            {results.map((r) => (
              <li key={r.id}>
                <HistoryMarketResultCard result={r} />
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      {hasErrors ? (
        <TabsContent value="errors">
          <ul className="grid gap-3">
            {failed.map((r) => (
              <li key={r.id}>
                <HistoryMarketResultCard result={r} />
              </li>
            ))}
          </ul>
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
