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
      className="flex items-center gap-2 md:gap-0"
      aria-label="등록 단계"
    >
      {REGISTER_STEPS.map((step, idx) => {
        const isCompleted = step.index < currentIndex
        const isCurrent = step.index === currentIndex
        return (
          <li
            key={step.id}
            className={cn(
              'flex items-center gap-2.5 last:flex-none',
              // 모바일: 현재 단계만 라벨 표시(폭 차지) / 나머지는 번호만.
              isCurrent ? 'min-w-0 flex-1' : 'flex-none',
              // 데스크탑: 모든 단계가 연결선으로 균등 분배되도록 li 는 flex-1.
              //   단, 라벨 자체는 잘리지 않게(아래 whitespace-nowrap) — 연결선이 남은 폭을 흡수.
              'md:flex-1',
            )}
          >
            {/* 번호 + 라벨 묶음 — 데스크탑에서 내용폭(flex-none)으로 두어 라벨이 잘리지 않게 한다. */}
            <div
              className={cn(
                'flex min-w-0 items-center gap-2.5',
                // 모바일 현재 단계는 라벨이 길 수 있어 truncate 허용(flex-1) — 화면폭 보호.
                isCurrent ? 'flex-1' : 'flex-none',
                'md:flex-none',
              )}
            >
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  isCurrent && 'border-ink bg-ink text-accent',
                  isCompleted && 'border-accent bg-accent-soft text-accent-onlight',
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
                  'text-sm tracking-tight',
                  // 데스크탑: 잘림 방지 — whitespace-nowrap + overflow-visible(truncate 무력화).
                  'min-w-0 md:overflow-visible md:whitespace-nowrap',
                  // 모바일 현재 단계: 화면폭 보호 위해 truncate(flex-1). 데스크탑은 flex-none + nowrap.
                  isCurrent && 'flex-1 truncate md:flex-none',
                  isCurrent && 'font-semibold text-text',
                  isCompleted && 'font-medium text-text',
                  !isCurrent && !isCompleted && 'font-medium text-text-tertiary',
                  // 비현재 단계는 모바일에서 라벨 숨김(번호만), 데스크탑은 표시.
                  !isCurrent && 'hidden md:block',
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < REGISTER_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  // 연결선이 남은 가로 폭을 흡수(flex-1) — 라벨과 폭 경쟁하지 않음.
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
