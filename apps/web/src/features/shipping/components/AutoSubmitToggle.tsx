import { Label } from '@/components/ui'

interface AutoSubmitToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/**
 * "출력 후 자동 제출" 토글 — settings (PR10) 와 연동.
 *
 * 본 PR 범위에서는 페이지 로컬 state 만 받고, settings persistence 는 PR10 hook 으로 wiring.
 * shadcn switch 미도입 상태이므로 native checkbox 사용 (디자인 시스템 토큰만 활용).
 * 추후 shadcn switch 도입 시 교체.
 */
export function AutoSubmitToggle({
  checked,
  onChange,
  disabled,
}: AutoSubmitToggleProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <input
        id="shipping-auto-submit"
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-accent"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby="shipping-auto-submit-desc"
      />
      <Label htmlFor="shipping-auto-submit" className="cursor-pointer text-sm">
        출력 후 자동 제출
      </Label>
      <span id="shipping-auto-submit-desc" className="sr-only">
        운송장 출력 완료 후 자동으로 송장 제출을 시작합니다.
      </span>
    </div>
  )
}
