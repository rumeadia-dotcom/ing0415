import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tooltip — ui-system.md §7
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
        'z-50 overflow-hidden rounded-md',
        'bg-text text-surface', // 반전: 본문에서 두드러지게
        'px-2.5 py-1.5 text-xs shadow-lg',
        'data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out',
        'max-w-xs',
        className,
      )}
      {...props}
    />
  )
})
