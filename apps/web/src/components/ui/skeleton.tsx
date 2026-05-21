import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - bg card2 oklch(0.985 0.006 75)
 *  - radius 8
 *  - animate-pulse (Tailwind 기본 keyframe)
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
          'animate-pulse rounded-[8px] bg-card-2 border border-border',
          className,
        )}
        {...props}
      />
    )
  },
)
