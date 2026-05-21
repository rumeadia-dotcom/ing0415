import * as ProgressPrimitive from '@radix-ui/react-progress'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Progress — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - track: card2 oklch(0.985 0.006 75), radius 999
 *  - fill: accent oklch(0.62 0.14 55), radius 999
 *
 * 사용 시 옆에 텍스트 "50%" 같은 동반 표기 강제 (색·시각만으로 의존 금지).
 * aria-valuenow / aria-valuetext 는 Radix 가 자동 처리.
 */
export const Progress = forwardRef<
  ElementRef<typeof ProgressPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(function Progress({ className, value, ...props }, ref) {
  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full',
        'bg-[oklch(0.985_0.006_75)] border border-[oklch(0.92_0.008_75)]',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 rounded-full',
          'bg-[oklch(0.62_0.14_55)] transition-transform duration-300 ease-out',
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
