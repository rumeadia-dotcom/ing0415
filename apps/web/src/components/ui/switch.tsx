import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Switch — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - track off: oklch(0.92 0.008 75) (border 토큰을 트랙으로 차용)
 *  - track on : oklch(0.55 0.10 160) (ok)
 *  - thumb    : #fff with soft shadow
 *  - radius   : 999 (full pill)
 *
 * Radix Switch 미설치 환경 대응: `<button role="switch">` 패턴으로 직접 구현.
 * 키보드 (Space/Enter) + aria-checked + focus ring 모두 표준 동작.
 */

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  /** 비활성 + 토글 사유 표시용 — disabled 만 두지 말고 사유 노출 (페르소나 룰 6). */
  disabled?: boolean
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, disabled, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked)
      }}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-success'
          : 'bg-border border border-border-strong',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_oklch(0_0_0_/_0.15)] transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
})
