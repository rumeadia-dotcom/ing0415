import { Check, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { useMarketCategoryTree } from '../hooks/useMarketCategoryTree'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import type { CategoryNode } from '@/lib/schemas'
import type { CategoryMapping } from '@/lib/schemas/registration'
import { cn } from '@/lib/utils'

interface CategoryMappingCardProps {
  marketId: MarketId
  mapping: CategoryMapping | null
  onChange: (mapping: CategoryMapping) => void
}

const BRAND_COLOR: Record<MarketId, string> = {
  naver: '#03C75A',
  coupang: '#F11F44',
  gmarket: '#00B147',
  auction: '#E73936',
  '11st': '#FF0038',
}

/**
 * 마켓별 카테고리 매핑 — Studio 룩 (horizontal row · 브랜드 dot + 라벨 + 경로 + select + 상태 pill).
 * 마스터: docs/architecture/v1/features/registration.md §10.5
 * 자동 추천(ML)은 v2.
 *
 * 트리는 깊이 N — flat 옵션으로 펼쳐서 (path 표시) native select 에 노출.
 */
export function CategoryMappingCard({ marketId, mapping, onChange }: CategoryMappingCardProps): JSX.Element {
  const { data, isLoading, isError } = useMarketCategoryTree(marketId)
  const label = MARKET_CATALOG[marketId].label
  const flatOptions = data ? flatten(data, []) : []
  const isMapped = Boolean(mapping?.marketCategoryCode)

  const selected = flatOptions.find((o) => o.code === mapping?.marketCategoryCode) ?? null
  const path = selected ? selected.path.join(' › ') : '— 카테고리 미선택'

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isMapped
          ? 'border-border bg-surface'
          : 'border-warning/30 bg-warning-soft/40',
      )}
    >
      <div className="grid items-center gap-3 md:grid-cols-[auto_1fr_240px_auto]">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: BRAND_COLOR[marketId] }}
        >
          {label.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text">{label}</p>
          <p
            className={cn(
              'mt-0.5 truncate text-[11.5px]',
              isMapped ? 'text-text-tertiary' : 'font-semibold text-warning-on-soft',
            )}
          >
            {path}
          </p>
        </div>
        {isLoading && <Skeleton className="h-9 w-full" />}
        {isError && (
          <p className="text-sm text-danger-on-soft">카테고리를 불러오지 못했습니다.</p>
        )}
        {!isLoading && !isError && (
          <select
            aria-label={`${label} 카테고리 선택`}
            className="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-[12.5px] text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
            isMapped
              ? 'bg-success-soft text-success-on-soft'
              : 'bg-warning-soft text-warning-on-soft',
          )}
        >
          {isMapped ? (
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          ) : (
            <AlertCircle className="h-3 w-3" aria-hidden />
          )}
          {isMapped ? '매핑 완료' : '선택 필요'}
        </span>
      </div>
    </div>
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
