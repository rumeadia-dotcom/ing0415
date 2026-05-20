import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton — 로딩 placeholder.
 * ui-system.md §7 — 모든 loading 상태에 사용. 카드/테이블/통계 프리셋은 후속 Stage 에서 추가.
 *
 * 접근성: 영역이 진짜 컨텐츠로 채워질 때까지 `aria-busy="true"` + `role="status"` 컨테이너로 감싸는 것을 권장.
 */
export const Skeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Skeleton({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          'animate-pulse-skeleton rounded-md bg-surface-muted',
          className,
        )}
        {...props}
      />
    )
  },
)
