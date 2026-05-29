import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  ErrorMessage,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { useMarketAccounts } from '@/features/markets/hooks/useMarketAccounts'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { MarketSelectGrid } from '../components/MarketSelectGrid'
import { MarketOptionsCard } from '../components/MarketOptionsCard'
import { makeStep3Schema } from '@/lib/schemas/registration'
import type { MarketSelection, CategoryMapping } from '@/lib/schemas/registration'
import { getRegistrationFieldsForMarket } from '@/lib/markets/registration-fields'
import { resolveKoPath } from '@/lib/i18n'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/features/markets/types'

/**
 * 마켓별 required 동적 등록필드 key provider — Step3Schema 검증과 blockingReasons 에 공유.
 * 어댑터 메타(getRegistrationFieldsForMarket)에서 required=true 필드 key 만 추린다.
 */
const requiredFieldKeysFor = (marketId: MarketId): string[] =>
  getRegistrationFieldsForMarket(marketId)
    .filter((f) => f.required)
    .map((f) => f.key)

const Step3Schema = makeStep3Schema(requiredFieldKeysFor)

/**
 * StepMarketsCategoriesPage — n17 + n19 통합 (3/5). Studio 룩.
 * 마스터: docs/architecture/v1/features/registration.md §10.5
 *
 * - v1 활성 5마켓 (naver/coupang/gmarket/auction/11st) 중 active 계정 보유 마켓만 체크박스 활성.
 * - 선택된 마켓 각각에 카테고리 매핑 row 표시.
 * - Step3Schema 통과 시 다음 활성.
 */
export function StepMarketsCategoriesPage(): JSX.Element {
  const navigate = useNavigate()
  const productId = useRegisterFormStore((s) => s.productId)
  const selections = useRegisterFormStore((s) => s.selections)
  const setSelections = useRegisterFormStore((s) => s.setSelections)
  const mappings = useRegisterFormStore((s) => s.mappings)
  const setMappings = useRegisterFormStore((s) => s.setMappings)

  useEffect(() => {
    if (!productId) navigate('/register/info', { replace: true })
  }, [productId, navigate])

  const { data: accounts, isLoading, isError } = useMarketAccounts()

  if (!productId) return <></>

  const handleSelectionChange = (next: MarketSelection[]): void => {
    setSelections(next)
    // 선택 해제된 마켓의 매핑도 제거
    setMappings(mappings.filter((m) => next.some((s) => s.marketId === m.marketId)))
  }

  const upsertMapping = (next: CategoryMapping): void => {
    const others = mappings.filter((m) => m.marketId !== next.marketId)
    setMappings([...others, next])
  }

  const mappingByMarket = new Map<MarketId, CategoryMapping>(
    mappings.map((m) => [m.marketId, m]),
  )

  const handleNext = (): void => {
    const parsed = Step3Schema.safeParse({ selections, mappings })
    if (!parsed.success) return
    navigate('/register/preview')
  }

  const blockingReasons: string[] = []
  if (selections.length === 0) blockingReasons.push('마켓을 1개 이상 선택하세요')
  if (selections.some((s) => !mappingByMarket.get(s.marketId)?.marketCategoryCode))
    blockingReasons.push('선택한 마켓의 카테고리를 모두 선택하세요')

  // 마켓별 동적 required 필드 미입력 → 어댑터 메타의 blockingReason 문구를 노출(중복 제거).
  for (const s of selections) {
    const opts = mappingByMarket.get(s.marketId)?.marketOptions ?? {}
    for (const field of getRegistrationFieldsForMarket(s.marketId)) {
      if (!field.required) continue
      const v = opts[field.key]
      const empty =
        v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
      if (empty && field.blockingReason) {
        const reason = resolveKoPath(field.blockingReason)
        if (!blockingReasons.includes(reason)) blockingReasons.push(reason)
      }
    }
  }

  return (
    <>
      {isLoading && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <ErrorMessage message="연결된 마켓 정보를 불러오지 못했습니다." />
        </div>
      )}
      {!isLoading && !isError && (
        <div className="flex flex-col gap-4">
          <MarketSelectGrid
            accounts={accounts ?? []}
            selections={selections}
            onChange={handleSelectionChange}
          />

          {selections.length > 0 ? (
            <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <header className="mb-3.5">
                <h2 className="text-[15px] font-bold text-text">
                  {ko.markets.registrationFields.card.sectionTitle}
                </h2>
                <p className="mt-1 text-[12.5px] text-text-tertiary">
                  {ko.markets.registrationFields.card.sectionDescription}
                </p>
              </header>
              <div className="flex flex-col gap-2.5">
                {selections.map((s) => (
                  <MarketOptionsCard
                    key={s.marketId}
                    marketId={s.marketId}
                    marketAccountId={s.marketAccountId}
                    mapping={mappingByMarket.get(s.marketId) ?? null}
                    onChange={upsertMapping}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-border-strong bg-surface-subtle p-8 text-center">
              <p className="text-[13.5px] font-semibold text-text-secondary">
                먼저 등록할 마켓을 1개 이상 선택하세요
              </p>
              <p className="mt-1 text-[12px] text-text-tertiary">
                선택하면 마켓별 카테고리 매핑 카드가 여기에 표시됩니다.
              </p>
            </section>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/register/images')}
          className="border border-border"
        >
          ← 이미지
        </Button>
        <div className="flex-1 text-[12.5px] text-text-tertiary">
          {blockingReasons.length > 0
            ? blockingReasons[0]
            : `${selections.length}개 마켓 매핑 완료`}
        </div>
        {blockingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="primary" disabled aria-disabled>
                  다음: 미리보기 →
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <ul className="space-y-0.5 text-xs">
                {blockingReasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="primary" onClick={handleNext}>
            다음: 미리보기 →
          </Button>
        )}
      </div>
    </>
  )
}

export default StepMarketsCategoriesPage
