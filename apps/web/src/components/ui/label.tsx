import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Label — ui-system.md §7
 * 폼 필드용 라벨. 필수 표시(`*`)는 children 에서 직접 명시.
 */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      // 컴포넌트 정의부 — 실제 control 연결은 사용처가 htmlFor 로 보장 (jsx-a11y 는
      // 사용처에서 검증한다).
      // eslint-disable-next-line jsx-a11y/label-has-associated-control
      <label
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none text-text',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className,
        )}
        {...props}
      />
    )
  },
)
