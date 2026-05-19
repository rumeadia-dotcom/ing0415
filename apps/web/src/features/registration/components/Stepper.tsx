import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stepper — 상품 등록 5단계 진행 표시.
 * frontend.md §2.3 user_flow n15~n21 매핑 / 페르소나 룰 2 (5단계 분리).
 *
 * 상태:
 *  - completed: 이전 단계 (체크 아이콘)
 *  - current: 현재 단계 (accent 강조)
 *  - upcoming: 미진입 단계 (text-tertiary)
 *
 * 모바일: 단계 번호 + 활성 라벨만 표시 (전체 라벨 가로 잘림 방지)
 * 데스크탑: 단계 번호 + 모든 라벨 + 연결선
 *
 * Stage C 는 시각만. 단계 간 검증 가드는 Stage D (RHF + zod).
 */
export type RegisterStepId = 'info' | 'images' | 'markets' | 'categories' | 'preview'

interface StepDef {
  id: RegisterStepId
  index: number
  label: string
}

export const REGISTER_STEPS: readonly StepDef[] = [
  { id: 'info', index: 1, label: '상품 정보' },
  { id: 'images', index: 2, label: '이미지' },
  { id: 'markets', index: 3, label: '마켓 선택' },
  { id: 'categories', index: 4, label: '카테고리' },
  { id: 'preview', index: 5, label: '미리보기' },
] as const

interface StepperProps {
  current: RegisterStepId
}

export function Stepper({ current }: StepperProps): JSX.Element {
  const currentIndex = REGISTER_STEPS.find((s) => s.id === current)?.index ?? 1

  return (
    <ol
      className="flex items-center gap-2 overflow-x-auto"
      aria-label="등록 단계"
    >
      {REGISTER_STEPS.map((step, idx) => {
        const isCompleted = step.index < currentIndex
        const isCurrent = step.index === currentIndex
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isCompleted && 'bg-success text-white',
                  isCurrent && 'bg-accent text-white',
                  !isCompleted && !isCurrent && 'bg-surface-muted text-text-tertiary',
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  step.index
                )}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-sm',
                  isCurrent ? 'font-semibold text-text' : 'text-text-secondary',
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
                  'hidden h-px flex-1 md:block',
                  step.index < currentIndex ? 'bg-success' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
