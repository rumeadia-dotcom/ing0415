import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * 표준 카드: bg white, border 1px oklch(0.92 0.008 75), radius 12~14, padding 18~22.
 * 데스크탑 padding 20 / 모바일 16 (기본). hero/feature 카드는 radius 16 + padding 22 (사용처에서 override).
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[12px] border border-border bg-white text-ink',
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
        className={cn('flex flex-col space-y-1.5 p-[18px] pb-3 md:p-[22px] md:pb-3', className)}
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
        className={cn(
          'text-[16px] font-bold leading-tight tracking-tight text-ink',
          className,
        )}
        {...props}
      >
        {children}
      </h3>
    )
  },
)

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...props }, ref) {
    return (
      <p
        ref={ref}
        className={cn('text-[12px] text-faint', className)}
        {...props}
      />
    )
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
    return <div ref={ref} className={cn('p-[18px] md:p-[22px]', className)} {...props} />
  },
)

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center p-[18px] md:p-[22px]', className)}
        {...props}
      />
    )
  },
)
