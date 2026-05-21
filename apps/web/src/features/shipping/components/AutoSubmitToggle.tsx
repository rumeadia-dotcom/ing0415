import { Label, Switch } from '@/components/ui'

interface AutoSubmitToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

/**
 * "출력 후 자동 제출" 토글 — settings (PR10) 와 연동.
 *
 * Studio 룩 — shadcn Switch + 한글 라벨 (sr-only desc 추가 = 보조기기 안내).
 * 본 PR 범위에서는 페이지 로컬 state 만 받고, settings persistence 는 PR10 hook 으로 wiring.
 */
export function AutoSubmitToggle({
  checked,
  onChange,
  disabled,
}: AutoSubmitToggleProps): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="shipping-auto-submit"
        checked={checked}
        onCheckedChange={onChange}
        {...(disabled ? { disabled } : {})}
        aria-describedby="shipping-auto-submit-desc"
        aria-label="출력 후 자동 제출 토글"
      />
      <Label
        htmlFor="shipping-auto-submit"
        className="cursor-pointer text-xs font-semibold text-text-secondary"
      >
        출력 후 자동 제출
      </Label>
      <span id="shipping-auto-submit-desc" className="sr-only">
        운송장 출력 완료 후 자동으로 송장 제출을 시작합니다.
      </span>
    </div>
  )
}
