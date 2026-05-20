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
        className={cn('flex flex-col space-y-1.5 p-4 pb-3 md:p-5 md:pb-3', className)}
        {...props}
      />
    )
  },
)

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, children, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('text-h2 leading-none tracking-tight text-text', className)}
        {...props}
      >
        {children}
      </h3>
    )
  },
)

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cn('text-sm text-text-secondary', className)} {...props} />
  },
)

/**
 * 정책 (2026-05-20 수정):
 * - CardContent / CardFooter 는 항상 모든 면 padding 적용.
 * - CardHeader 와 페어로 쓸 때는 header 의 pb-3 가 사이 간격을 조절 — 이중 패딩 보이지 않음.
 * - 표준 shadcn 의 `pt-0` 룰은 standalone 사용 시 카드 상단이 깨지는 문제로 제거.
 */
export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn('p-4 md:p-5', className)} {...props} />
  },
)

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center p-4 md:p-5', className)}
        {...props}
      />
    )
  },
)
