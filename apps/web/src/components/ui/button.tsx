import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Button — ui-system.md §7 / 페르소나 룰 5
 *
 * variant 분리 룰 (강제):
 *  - 실행류 (서버 변경): primary / secondary / danger
 *  - 검색·필터류 (즉시 결과 갱신): ghost / outline
 *  - 텍스트 링크: link
 *
 * size:
 *  - sm 30h / md 36h(기본) / lg 44h(모바일 기본 = 터치 타겟) / icon 정사각
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-md font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent !text-white hover:bg-accent-hover',
        secondary: 'bg-surface-muted text-text hover:bg-border',
        ghost: 'text-text hover:bg-surface-muted',
        outline: 'border border-border-strong bg-surface text-text hover:bg-surface-muted',
        danger: 'bg-danger !text-white hover:bg-danger/90',
        link: 'text-accent underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-[30px] px-3 text-xs',
        md: 'h-9 px-3.5 text-button',
        lg: 'h-11 px-4 text-button-mobile',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type = 'button', ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      // asChild=true 일 때는 type 속성이 자식에 위임됨
      {...(asChild ? {} : { type })}
      {...props}
    />
  )
})

export { buttonVariants }
