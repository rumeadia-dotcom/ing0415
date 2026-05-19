import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Input — ui-system.md §7
 * - 모바일 h ≥44px 위해 lg 변형 분리 (필요 시 className 으로 `h-11` override)
 * - error 상태는 `aria-invalid="true"` 로 분기 (별도 prop 안 둠)
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border-strong bg-surface px-3 py-1.5',
        'text-body text-text placeholder:text-text-tertiary',
        'transition-colors',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-muted',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger',
        // 모바일에서 줌인 방지 위해 16px 기본
        'md:text-sm',
        className,
      )}
      {...props}
    />
  )
})
