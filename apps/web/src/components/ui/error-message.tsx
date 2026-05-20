import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * ErrorMessage — ui-system.md §8
 *
 * - role="alert" + aria-live="polite"
 * - 긴 stack / raw response 는 `<details>` 로 접힘 기본
 * - tone: 'error' (danger) | 'warning' (warning)
 */
export interface ErrorMessageProps {
  /** 사용자에게 보여줄 짧은 메시지 */
  message: ReactNode
  /** 상세 정보 (raw response, stack 등) — 접힘 기본 */
  details?: string
  tone?: 'error' | 'warning'
  className?: string
}

export function ErrorMessage({
  message,
  details,
  tone = 'error',
  className,
}: ErrorMessageProps): JSX.Element {
  const detailsId = useId()
  const [open, setOpen] = useState(false)

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex flex-col gap-1 rounded-md border px-3 py-2 text-sm',
        tone === 'error'
          ? 'border-danger/30 bg-danger-soft text-danger-on-soft'
          : 'border-warning/30 bg-warning-soft text-warning-on-soft',
        className,
      )}
    >
      <div className="font-medium">{message}</div>
      {details ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
            className="self-start text-xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {open ? '상세 숨기기' : '상세 보기'}
          </button>
          {open ? (
            <pre
              id={detailsId}
              className="mt-1 max-h-48 overflow-auto rounded bg-surface-muted px-2 py-1 text-xs"
            >
              {details}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
