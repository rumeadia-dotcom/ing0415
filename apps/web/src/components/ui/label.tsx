import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Label — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - fontSize 12
 *  - weight 600
 *  - color oklch(0.48 0.012 60) (dim)
 *  - margin-bottom 6 (사용처에서 처리 — 라벨은 자체 마진 없음)
 *
 * 폼 필드용. 필수 표시(`*`)는 children 에서 직접 명시.
 */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      // 컴포넌트 정의부 — 실제 control 연결은 사용처가 htmlFor 로 보장 (jsx-a11y 는 사용처에서 검증).
      // eslint-disable-next-line jsx-a11y/label-has-associated-control
      <label
        ref={ref}
        className={cn(
          'block text-[12px] font-semibold leading-none text-dim',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className,
        )}
        {...props}
      />
    )
  },
)
