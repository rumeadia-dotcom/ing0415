import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tooltip — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - bg ink oklch(0.15 0.015 60)
 *  - text #fff
 *  - radius 8
 *  - padding 6/10
 *  - fontSize 12
 *
 * 데스크탑 hover 전용. 모바일에서는 long-press 동작 (Radix 기본).
 * blockingReasons 표시에 필수 — disabled 버튼 사유 노출용 (페르소나 룰 6).
 */
export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-[8px]',
        'bg-[oklch(0.15_0.015_60)] text-white',
        'px-[10px] py-[6px] text-[12px] font-medium',
        'shadow-[0_8px_16px_-4px_oklch(0_0_0_/_0.25)]',
        'data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out',
        'max-w-xs',
        className,
      )}
      {...props}
    />
  )
})
