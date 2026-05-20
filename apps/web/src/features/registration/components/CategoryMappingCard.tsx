import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui'
import { useMarketCategoryTree } from '../hooks/useMarketCategoryTree'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { CategoryNode } from '@/lib/schemas'
import type { CategoryMapping } from '@/lib/schemas/registration'

interface CategoryMappingCardProps {
  marketId: MarketId
  mapping: CategoryMapping | null
  onChange: (mapping: CategoryMapping) => void
}

/**
 * 마켓별 카테고리 매핑 카드 — useMarketCategoryTree + native select.
 * 자동 추천(ML) 은 v2.
 *
 * 트리는 깊이 N — flat 옵션으로 펼쳐서 (path 표시) native select 에 노출.
 */
export function CategoryMappingCard({ marketId, mapping, onChange }: CategoryMappingCardProps): JSX.Element {
  const { data, isLoading, isError } = useMarketCategoryTree(marketId)
  const label = MARKET_CATALOG[marketId].label

  const flatOptions = data ? flatten(data, []) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} 카테고리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-10 w-full" />}
        {isError && <p className="text-sm text-danger-on-soft">카테고리를 불러오지 못했습니다.</p>}
        {!isLoading && !isError && (
          <select
            aria-label={`${label} 카테고리 선택`}
            className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-button shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={mapping?.marketCategoryCode ?? ''}
            onChange={(e) => {
              onChange({
                marketId,
                marketCategoryCode: e.target.value,
                marketNameOverride: mapping?.marketNameOverride ?? null,
                marketPriceOverride: mapping?.marketPriceOverride ?? null,
                marketOptions: mapping?.marketOptions ?? {},
              })
            }}
          >
            <option value="">— 카테고리 선택 —</option>
            {flatOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.path.join(' > ')}
              </option>
            ))}
          </select>
        )}
      </CardContent>
    </Card>
  )
}

interface FlatOption {
  code: string
  path: string[]
}

function flatten(nodes: CategoryNode[], parentPath: string[]): FlatOption[] {
  const acc: FlatOption[] = []
  for (const n of nodes) {
    const path = [...parentPath, n.name]
    if (n.leaf || !n.children || n.children.length === 0) {
      acc.push({ code: n.id, path })
    } else {
      acc.push(...flatten(n.children, path))
    }
  }
  return acc
}
