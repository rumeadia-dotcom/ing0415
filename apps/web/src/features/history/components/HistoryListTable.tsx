import { useEffect, useRef } from 'react'
import { ErrorMessage, Skeleton } from '@/components/ui'
import type { JobSummary } from '@/lib/schemas/history-filter'
import { HistoryListRow } from './HistoryListRow'

interface HistoryListTableProps {
  state: 'loading' | 'data' | 'error' | 'empty'
  jobs: readonly JobSummary[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  errorMessage?: string | undefined
}

/**
 * 데스크탑: `<table>` (Studio 카드 셸 — 좌측 3px 상태 바 + dense rows).
 * 모바일: 카드 그리드.
 * 페이지 끝 도달 시 IntersectionObserver 가 `onLoadMore` 호출 (무한 스크롤).
 */
export function HistoryListTable({
  state,
  jobs,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  errorMessage,
}: HistoryListTableProps): JSX.Element {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasNextPage) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isFetchingNextPage) {
            onLoadMore()
          }
        }
      },
      { rootMargin: '160px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  if (state === 'loading') {
    return (
      <div
        className="space-y-2"
        role="status"
        aria-live="polite"
        aria-label="목록 불러오는 중"
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <ErrorMessage
        tone="error"
        message={errorMessage ?? '이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
      />
    )
  }

  if (state === 'empty') {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-text-secondary">
        조건에 맞는 등록 이력이 없습니다.
      </div>
    )
  }

  return (
    <div>
      {/* 데스크탑 테이블 — Studio 단일 카드 + sticky header */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <table className="w-full border-collapse" aria-label="등록 이력 목록">
          <thead className="border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
            <tr>
              <th scope="col" className="w-[3px] p-0" aria-hidden />
              <th scope="col" className="w-[88px] px-3 py-2.5 font-semibold">
                잡 ID
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                상품명
              </th>
              <th scope="col" className="w-[110px] px-3 py-2.5 font-semibold">
                상태
              </th>
              <th
                scope="col"
                className="w-[120px] px-3 py-2.5 text-right font-semibold"
              >
                생성
              </th>
              <th
                scope="col"
                className="w-[80px] px-3 py-2.5 text-right font-semibold"
              >
                재시도
              </th>
              <th scope="col" className="w-7 px-2 py-2.5" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <HistoryListRow key={j.id} job={j} variant="table" />
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="space-y-2 md:hidden">
        {jobs.map((j) => (
          <HistoryListRow key={j.id} job={j} variant="card" />
        ))}
      </div>

      {/* sentinel (무한 스크롤) — Studio: "더 불러오기" 톤 */}
      {hasNextPage ? (
        <div ref={sentinelRef} className="mt-4 flex justify-center py-4" aria-hidden>
          {isFetchingNextPage ? (
            <Skeleton className="h-9 w-40 rounded-md" />
          ) : (
            <span className="text-xs text-text-tertiary">
              스크롤하여 더 보기
            </span>
          )}
        </div>
      ) : jobs.length > 0 ? (
        <div className="mt-4 py-2 text-center text-[11px] uppercase tracking-wider text-text-tertiary">
          — 끝 —
        </div>
      ) : null}
    </div>
  )
}
