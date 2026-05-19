import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card — ui-system.md §7
 * 데스크탑 padding 20 / 모바일 16 (ui-system.md §5 컴포넌트 패딩)
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-surface text-text shadow-sm',
        className,
      )}
      {...props}
    />
  )
})

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-4 md:p-5', className)}
        {...props}
      />
    )
  },
)

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('text-h2 leading-none tracking-tight text-text', className)}
        {...props}
      />
    )
  },
)

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cn('text-sm text-text-secondary', className)} {...props} />
  },
)

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('p-4 pt-0 md:p-5 md:pt-0', className)} {...props} />
  },
)

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center p-4 pt-0 md:p-5 md:pt-0', className)}
        {...props}
      />
    )
  },
)
