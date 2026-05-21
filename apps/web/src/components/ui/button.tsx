import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Button — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * variant 분리 룰 (강제):
 *  - 실행류 (서버 변경): primary / secondary / danger
 *  - 검색·필터류 (즉시 결과 갱신): ghost / outline
 *  - 텍스트 링크: link
 *
 * size:
 *  - sm 30h / md 36h(기본) / lg 44h(모바일 기본 = 터치 타겟) / icon 정사각
 *
 * Studio 토큰 (OKLCH arbitrary — PR1 globals.css 머지 이후 토큰 클래스로 교체 예정):
 *  - ink: oklch(0.15 0.015 60)
 *  - card: #fff
 *  - border: oklch(0.92 0.008 75)
 *  - borderHi: oklch(0.85 0.01 75)
 *  - dim: oklch(0.48 0.012 60)
 *  - accent (focus): oklch(0.62 0.14 55)
 *  - danger: oklch(0.55 0.16 25)
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-[10px] font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-ink !text-white hover:bg-text font-bold',
        secondary:
          'bg-white text-ink border border-border-strong hover:bg-card-2 font-semibold',
        ghost:
          'bg-transparent text-dim border border-border hover:bg-card-2 hover:text-ink font-semibold',
        outline:
          'bg-transparent text-dim border border-border hover:bg-card-2 hover:text-ink font-semibold',
        danger:
          'bg-danger !text-white hover:brightness-90 font-bold border-none',
        link: 'text-accent underline-offset-4 hover:underline px-0 h-auto bg-transparent border-none font-semibold',
      },
      size: {
        // sm: padding 6/12, radius 8, fontSize 12.5
        sm: 'h-[30px] px-3 text-[12.5px] rounded-[8px]',
        // md (default): padding 10/16~18 per variant, fontSize 14
        md: 'min-h-[36px] px-4 py-[10px] text-[14px]',
        // lg: 44px touch target (mobile primary)
        lg: 'min-h-[44px] px-[18px] py-[10px] text-[14px]',
        icon: 'h-9 w-9 p-0',
      },
    },
    compoundVariants: [
      // primary 의 가로 패딩은 18 (Studio spec)
      { variant: 'primary', size: 'md', class: 'px-[18px]' },
    ],
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
