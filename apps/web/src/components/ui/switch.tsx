import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Switch — shadcn 스타일 ON/OFF 토글.
 *
 * Radix Switch 미설치 환경 대응: `<button role="switch">` 패턴으로 직접 구현.
 * 키보드 (Space/Enter) + aria-checked + focus ring 모두 표준 동작.
 *
 * 마스터: docs/architecture/v1/ui-system.md (token-only color/radius)
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-surface shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
})
