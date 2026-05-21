import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stepper — 상품 등록 5단계 진행 표시 (Studio 룩).
 * frontend.md §2.3 / user_flow n15~n21 / docs/design-renewal/s3-register.md
 *
 * 상태:
 *  - completed: 이전 단계 — accent-soft bg + accent ring + check 아이콘
 *  - current: 현재 단계 — ink 채움 + accent 텍스트
 *  - upcoming: 미진입 단계 — surface + border + text-tertiary
 *
 * 모바일: 단계 번호만 노출 (현재 단계는 라벨도 표시). 데스크탑: 모든 라벨 + 가로 연결선.
 */
export type RegisterStepId = 'info' | 'images' | 'markets' | 'preview' | 'result'

interface StepDef {
  id: RegisterStepId
  index: number
  label: string
}

export const REGISTER_STEPS: readonly StepDef[] = [
  { id: 'info', index: 1, label: '상품 정보' },
  { id: 'images', index: 2, label: '이미지' },
  { id: 'markets', index: 3, label: '마켓 · 카테고리' },
  { id: 'preview', index: 4, label: '미리보기' },
  { id: 'result', index: 5, label: '결과' },
] as const

interface StepperProps {
  current: RegisterStepId
}

export function Stepper({ current }: StepperProps): JSX.Element {
  const currentIndex = REGISTER_STEPS.find((s) => s.id === current)?.index ?? 1

  return (
    <ol
      className="flex items-center gap-0"
      aria-label="등록 단계"
    >
      {REGISTER_STEPS.map((step, idx) => {
        const isCompleted = step.index < currentIndex
        const isCurrent = step.index === currentIndex
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2.5 last:flex-none">
            <div className="flex items-center gap-2.5">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  isCurrent && 'border-ink bg-ink text-accent',
                  isCompleted && 'border-accent bg-accent-soft text-accent',
                  !isCompleted && !isCurrent && 'border-border bg-surface text-text-tertiary',
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
                ) : (
                  step.index
                )}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-sm tracking-tight',
                  isCurrent && 'font-semibold text-text',
                  isCompleted && 'font-medium text-text',
                  !isCurrent && !isCompleted && 'font-medium text-text-tertiary',
                  !isCurrent && 'hidden md:inline',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < REGISTER_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'mx-3 hidden h-[1.5px] flex-1 md:block',
                  step.index < currentIndex ? 'bg-accent/50' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
