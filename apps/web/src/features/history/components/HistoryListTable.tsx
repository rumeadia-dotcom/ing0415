import { useEffect, useRef } from 'react'
import { Skeleton } from '@/components/ui'
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
 * 데스크탑: `<table>`, 모바일: card grid.
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
      <div className="space-y-2" role="status" aria-live="polite" aria-label="목록 불러오는 중">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-md border border-danger/40 bg-danger-soft/40 p-4 text-sm text-danger-on-soft" role="alert">
        {errorMessage ?? '이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'}
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-secondary">
        조건에 맞는 등록 이력이 없습니다.
      </div>
    )
  }

  return (
    <div>
      {/* 데스크탑 테이블 */}
      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse" aria-label="등록 이력 목록">
          <thead className="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-text-secondary">
            <tr>
              <th scope="col" className="p-3 font-semibold w-[40%]">상품명</th>
              <th scope="col" className="p-3 font-semibold w-[16%]">상태</th>
              <th scope="col" className="p-3 font-semibold w-[20%]">마켓</th>
              <th scope="col" className="p-3 font-semibold w-[12%]">생성</th>
              <th scope="col" className="p-3 font-semibold w-[12%]">재시도</th>
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

      {/* sentinel (무한 스크롤) */}
      {hasNextPage ? (
        <div ref={sentinelRef} className="mt-4 py-4 text-center" aria-hidden>
          {isFetchingNextPage ? (
            <Skeleton className="mx-auto h-10 w-32" />
          ) : (
            <span className="text-xs text-text-tertiary">스크롤하여 더 보기</span>
          )}
        </div>
      ) : jobs.length > 0 ? (
        <div className="mt-4 py-2 text-center text-xs text-text-tertiary">— 끝 —</div>
      ) : null}
    </div>
  )
}
