import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * ErrorMessage — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * - role="alert" + aria-live="polite"
 * - 긴 stack / raw response 는 토글로 접힘 기본 (>2줄 권장)
 * - 토글 라벨은 accent 색 텍스트 링크: "자세히 보기" / "접기"
 * - tone: 'error' (danger) | 'warning' (warn)
 *
 * 시맨틱 페어:
 *  - danger: fg oklch(0.55 0.16 25) / bg oklch(0.95 0.03 25)
 *  - warn  : fg oklch(0.62 0.12 70) / bg oklch(0.95 0.04 75)
 *  - accent (toggle link): oklch(0.62 0.14 55)
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
        'flex flex-col gap-1 rounded-[10px] border px-3 py-2.5 text-[13px]',
        tone === 'error'
          ? 'border-danger/30 bg-danger-soft text-danger-on-soft'
          : 'border-warning/30 bg-warning-soft text-warning-on-soft',
        className,
      )}
    >
      <div className="font-semibold text-[13.5px] leading-snug">{message}</div>
      {details ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'self-start text-[12px] font-semibold text-accent',
              'underline-offset-2 hover:underline',
              'focus-visible:outline-none focus-visible:underline',
            )}
          >
            {open ? '접기' : '자세히 보기'}
          </button>
          {open ? (
            <pre
              id={detailsId}
              className={cn(
                'mt-1 max-h-48 overflow-auto rounded-[8px] px-2.5 py-2',
                'bg-card-2 text-[11.5px] text-dim',
                'font-mono whitespace-pre-wrap break-words',
              )}
              style={{ fontFamily: 'ui-monospace, "JetBrains Mono", monospace' }}
            >
              {details}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
