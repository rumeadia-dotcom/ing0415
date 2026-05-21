import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Input — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - radius 10
 *  - padding 10/12
 *  - border 1px oklch(0.85 0.01 75) (borderHi)
 *  - bg white
 *  - fontSize 13.5
 *  - font inherit (Manrope/Pretendard from ancestor)
 *  - outline none, focus accent ring
 *
 * Error 상태 (`aria-invalid="true"`):
 *  - border 1.5px oklch(0.55 0.16 25)
 *  - helper text (별도 컴포넌트 사용처) 11.5px danger color
 *
 * 모바일 줌인 방지 — md 이하 16px 기본 (`text-base`).
 */
export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex w-full rounded-[10px]',
        'border border-[oklch(0.85_0.01_75)] bg-white',
        'px-3 py-[10px]',
        'text-[16px] md:text-[13.5px] text-[oklch(0.15_0.015_60)] placeholder:text-[oklch(0.68_0.01_60)]',
        'transition-colors outline-none',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.62_0.14_55_/_0.4)] focus-visible:border-[oklch(0.62_0.14_55)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[oklch(0.985_0.006_75)]',
        'aria-[invalid=true]:border-[1.5px] aria-[invalid=true]:border-[oklch(0.55_0.16_25)]',
        'aria-[invalid=true]:focus-visible:ring-[oklch(0.55_0.16_25_/_0.4)]',
        className,
      )}
      style={{ fontFamily: 'inherit' }}
      {...props}
    />
  )
})
