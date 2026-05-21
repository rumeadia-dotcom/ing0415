import * as TabsPrimitive from '@radix-ui/react-tabs'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tabs — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - TabsList : border-bottom 1px oklch(0.92 0.008 75) (border)
 *  - 비활성 trigger: dim oklch(0.48 0.012 60)
 *  - 활성 trigger : ink oklch(0.15 0.015 60) + 하단 underline 2px accent
 *
 * 등록 결과 성공/실패 탭, 마켓 계정 상세 탭에서 사용.
 */
export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-start gap-1',
        'border-b border-[oklch(0.92_0.008_75)]',
        className,
      )}
      {...props}
    />
  )
})

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap',
        'px-4 py-2 text-[13.5px] font-semibold',
        '-mb-[1px] border-b-2 border-transparent',
        'text-[oklch(0.48_0.012_60)]',
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.62_0.14_55_/_0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-t-[6px]',
        'disabled:pointer-events-none disabled:opacity-50',
        'hover:text-[oklch(0.15_0.015_60)]',
        'data-[state=active]:text-[oklch(0.15_0.015_60)]',
        'data-[state=active]:border-b-[oklch(0.62_0.14_55)]',
        className,
      )}
      {...props}
    />
  )
})

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-4',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.62_0.14_55_/_0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-[8px]',
        className,
      )}
      {...props}
    />
  )
})
