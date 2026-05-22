import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { openPostcodePopup, formatPostcodeAddress } from '@/lib/daum-postcode'
import { cn } from '@/lib/utils'

/**
 * AddressSearchInput — Daum Postcode 기반 주소 입력.
 * 마스터: docs/architecture/v1/features/settings-shipping.md (s9 n60)
 *
 * 정책:
 *  - 도로명 주소는 수기 입력 금지 → 주소 검색 팝업으로만 입력.
 *  - 상세 주소(호수/동/층)는 수기 입력 허용 (Daum 가 채워주지 않음).
 *  - 외부 value 는 "[우편번호] 도로명 상세" 단일 문자열로 유지.
 *
 * 한계:
 *  - 외부에서 value 가 prefill 되면 도로명/상세 분리가 어렵다.
 *    이 경우 전체 문자열을 도로명 영역에 표시하고 상세는 비워둔다.
 *    재검색 시 도로명이 갱신되며 상세는 유지된다.
 */
export interface AddressSearchInputProps {
  id: string
  label: string
  /** 통합 주소 문자열. "[12345] 도로명 상세" 형태. */
  value: string
  onChange: (combined: string) => void
  errorMessage?: string | undefined
  disabled?: boolean
  required?: boolean
  hint?: string
}

export function AddressSearchInput({
  id,
  label,
  value,
  onChange,
  errorMessage,
  disabled = false,
  required = false,
  hint,
}: AddressSearchInputProps): JSX.Element {
  // 내부적으로 base(도로명+우편번호) / detail(상세) 분리. 외부 value 는 합쳐서 반환.
  const [base, setBase] = useState<string>(value)
  const [detail, setDetail] = useState<string>('')
  const [popupError, setPopupError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const hydrated = useRef(false)
  const detailId = `${id}-detail`

  // 외부 value 1회 hydrate.
  useEffect(() => {
    if (hydrated.current) return
    if (value) {
      setBase(value)
      hydrated.current = true
    }
  }, [value])

  function emit(nextBase: string, nextDetail: string): void {
    const b = nextBase.trim()
    const d = nextDetail.trim()
    const combined = d ? `${b} ${d}`.trim() : b
    onChange(combined)
  }

  async function handleSearch(): Promise<void> {
    if (disabled) return
    setPopupError(null)
    setOpening(true)
    try {
      const data = await openPostcodePopup()
      if (!data) return // 사용자가 팝업 닫음
      const nextBase = formatPostcodeAddress(data)
      setBase(nextBase)
      hydrated.current = true
      emit(nextBase, detail)
    } catch (err) {
      setPopupError(err instanceof Error ? err.message : '주소 검색을 시작할 수 없습니다')
    } finally {
      setOpening(false)
    }
  }

  function handleDetailChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const next = e.target.value
    setDetail(next)
    emit(base, next)
  }

  const hasBase = base.length > 0
  const errorId = errorMessage ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {required && <span className="text-[11px] font-bold text-danger">*</span>}
      </div>

      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          readOnly
          value={base}
          placeholder="주소 검색 버튼을 눌러 입력하세요"
          aria-invalid={errorMessage ? true : undefined}
          aria-readonly="true"
          aria-describedby={describedBy}
          tabIndex={-1}
          className={cn('flex-1 bg-surface-subtle/40', !hasBase && 'text-text-tertiary')}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void handleSearch()
          }}
          disabled={disabled || opening}
          className="shrink-0"
        >
          <Search className="mr-1.5 h-4 w-4" aria-hidden />
          {opening ? '여는 중…' : '주소 검색'}
        </Button>
      </div>

      <Input
        id={detailId}
        type="text"
        placeholder="상세 주소 (호수·동·층, 선택)"
        value={detail}
        onChange={handleDetailChange}
        disabled={disabled || !hasBase}
        aria-label={`${label} 상세`}
        autoComplete="off"
      />

      {hint && (
        <p id={hintId} className="text-xs text-text-tertiary">
          {hint}
        </p>
      )}
      {popupError && (
        <p role="alert" className="text-xs font-medium text-danger-on-soft">
          {popupError}
        </p>
      )}
      {errorMessage && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger-on-soft">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
