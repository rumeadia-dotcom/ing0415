import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  CardContent,
  ErrorMessage,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { useMarketAccounts } from '@/features/markets/hooks/useMarketAccounts'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { MarketSelectGrid } from '../components/MarketSelectGrid'
import { CategoryMappingCard } from '../components/CategoryMappingCard'
import { Step3Schema } from '@/lib/schemas/registration'
import type { MarketSelection, CategoryMapping } from '@/lib/schemas/registration'
import type { MarketId } from '@/features/markets/types'

/**
 * StepMarketsCategoriesPage — n17 + n19 통합 (3/5).
 * 마스터: docs/architecture/v1/features/registration.md §10.5
 *
 * - 4마켓 (v1 활성) 중 active 계정 보유 마켓만 체크박스 활성.
 * - 선택된 마켓 각각에 카테고리 매핑 카드 표시.
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

  return (
    <>
      {isLoading && (
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}
      {isError && (
        <Card>
          <CardContent className="py-6">
            <ErrorMessage message="연결된 마켓 정보를 불러오지 못했습니다." />
          </CardContent>
        </Card>
      )}
      {!isLoading && !isError && (
        <>
          <MarketSelectGrid
            accounts={accounts ?? []}
            selections={selections}
            onChange={handleSelectionChange}
          />

          {selections.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selections.map((s) => (
                <CategoryMappingCard
                  key={s.marketId}
                  marketId={s.marketId}
                  mapping={mappingByMarket.get(s.marketId) ?? null}
                  onChange={upsertMapping}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate('/register/images')}>
          ← 이전
        </Button>
        {blockingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="primary" disabled aria-disabled>
                  다음: 미리보기
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
            다음: 미리보기
          </Button>
        )}
      </div>
    </>
  )
}

export default StepMarketsCategoriesPage
