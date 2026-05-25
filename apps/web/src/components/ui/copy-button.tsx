import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

/**
 * CopyButton — value 를 클립보드로 복사 + 시각 피드백.
 *
 * 사용: 주문번호 / 운송장번호 / 외부 상품 ID / API key 등 mono 식별자 옆.
 *
 * 동작:
 *  - 클릭 → navigator.clipboard.writeText(value)
 *  - 성공 시 Check 아이콘 1.5s + 토스트 (label 이 있으면 "주문번호 복사됨")
 *  - 실패 (https / 권한 / unsupported) 시 generic 토스트 에러
 *
 * a11y:
 *  - aria-label = `${label} 복사` (label 미지정 시 "복사")
 *  - 복사 직후 aria-live="polite" 로 SR 안내
 */
export interface CopyButtonProps {
  /** 복사할 텍스트 */
  value: string
  /** SR 안내 + 토스트 라벨 (예: "주문번호") */
  label?: string
  className?: string
  size?: 'sm' | 'md'
}

export function CopyButton({
  value,
  label,
  className,
  size = 'sm',
}: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false)

  async function handleClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(label ? `${label} 복사됨` : '복사됨')
      window.setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'clipboard copy failed',
      )
      toast.error('복사에 실패했습니다. 브라우저 권한을 확인해 주세요.')
    }
  }

  const a11yLabel = label ? `${label} 복사` : '복사'
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void handleClick()
      }}
      aria-label={a11yLabel}
      aria-live="polite"
      className={cn('h-7 w-7 p-0', className)}
    >
      {copied ? (
        <Check className={cn(iconSize, 'text-success')} aria-hidden />
      ) : (
        <Copy className={iconSize} aria-hidden />
      )}
    </Button>
  )
}
