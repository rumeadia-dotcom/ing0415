import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui'
import { ko } from '@/locales/ko'

/**
 * SafeNumberBadge — 쿠팡 v5 안심번호(가상번호) UI 안내 배지.
 *
 * 배경:
 *  - 쿠팡 v5 부터 셀러에게 실 전화번호 대신 050 가상번호만 노출됨.
 *  - 셀러가 표시된 번호로 통화하면 자동으로 수취인 연락처로 연결되지만,
 *    UI 상 "이게 진짜 번호인지" 혼동이 생길 수 있어 배지 + 툴팁으로 명시.
 *
 * 접근성 (WCAG 2.1 AA):
 *  - trigger 는 Radix Tooltip 기본 button (focusable, role="button") — 키보드 focus 시 툴팁 노출.
 *  - 아이콘은 `aria-hidden` 으로 보조기술 무시, 텍스트 라벨 ("안심번호") 로 의미 전달.
 *  - 추가 aria-label 로 trigger 자체에 "안심번호 안내" 부여.
 *  - 색상은 토큰만 (muted-foreground / surface-muted / border).
 */
export function SafeNumberBadge(): JSX.Element {
  const labels = ko.orders.detail

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={labels.safeNumberAriaLabel}
        className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        <Info className="h-3 w-3" aria-hidden="true" />
        <span>{labels.safeNumberBadge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-left">
        {labels.safeNumberNote}
      </TooltipContent>
    </Tooltip>
  )
}
