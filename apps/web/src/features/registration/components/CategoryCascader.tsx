import { useEffect, useState } from 'react'
import { ErrorMessage, Skeleton } from '@/components/ui'
import { useMarketCategoryChildren } from '../hooks/useMarketCategoryChildren'
import { CategoryFetchError } from '../api/category-api'
import { MARKET_CATALOG, type MarketId } from '@/features/markets/types'
import { ko } from '@/locales/ko'
import type { CategoryNode } from '@/lib/schemas'
import { cn } from '@/lib/utils'

/**
 * CategoryCascader — 부모코드 직계 자식만 조회하는 단계별 카테고리 select (s3 3단계).
 * 마스터: docs/architecture/v1/features/category-sync.md §6.2 / §6.3
 *
 * 동작:
 *  - 진입 시 1단계(parentId=null=대분류). 각 단계는 useMarketCategoryChildren 로 직계 자식 조회.
 *  - leaf=false 선택 → 다음 단계 추가(자식 조회) + onChange('') (아직 미확정).
 *  - leaf=true 선택 → onChange(node.id, pathLabels) 확정 + 이후 단계 제거.
 *  - 상위 단계 재선택 → 그 아래 단계 전부 reset.
 *  - 4상태: loading=Skeleton / error=ErrorMessage(접힘) / empty(자식 0=최하위 안내) / data=select.
 *  - 네이버 등 category_not_supported → fallback 안내 카드.
 *
 * 선택된 marketCategoryCode 의 단일 소스는 상위(MarketOptionsCard)의 mapping.marketCategoryCode.
 * Cascader 의 levels 는 UI 단계 상태(어느 부모를 펼쳤는지)만 보유 — value 가 ''(미확정)이면 단계 초기화.
 */

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-[12.5px] text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

interface CategoryCascaderProps {
  marketId: MarketId
  marketAccountId: string
  /** 확정된 marketCategoryCode (상위 mapping). '' / null = 미선택. */
  value: string | null
  /** leaf 확정 시 code + 선택 경로 라벨. 비-leaf 진행 중에는 code='' 로 미확정 통지. */
  onChange: (code: string, pathLabels: string[]) => void
}

/** UI 단계 상태 — 어느 부모를 펼쳤는지 + 그 단계에서 선택한 노드 id/라벨. */
interface Level {
  parentId: string | null
  selectedId: string | null
  selectedLabel: string | null
}

export function CategoryCascader({
  marketId,
  marketAccountId,
  value,
  onChange,
}: CategoryCascaderProps): JSX.Element {
  const [levels, setLevels] = useState<Level[]>([
    { parentId: null, selectedId: null, selectedLabel: null },
  ])

  // 마켓/계정이 바뀌면 단계 상태를 초기화(다른 마켓의 단계가 남지 않도록).
  useEffect(() => {
    setLevels([{ parentId: null, selectedId: null, selectedLabel: null }])
  }, [marketId, marketAccountId])

  // 외부에서 value 가 '' 로 리셋되었는데 단계가 진행돼 있으면 대분류로 되돌린다(상위가 매핑 해제한 경우).
  useEffect(() => {
    if ((value == null || value === '') && levels.length > 1) {
      const hasSelection = levels.some((lv) => lv.selectedId != null)
      if (!hasSelection) {
        setLevels([{ parentId: null, selectedId: null, selectedLabel: null }])
      }
    }
    // levels 변화에 반응하지 않도록 value 만 의존(무한 루프 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const marketLabel = MARKET_CATALOG[marketId].label

  /**
   * 특정 단계에서 노드를 선택했을 때. 다음 levels 를 순수 계산한 뒤 setLevels + onChange 를
   * 렌더 밖(이벤트 핸들러)에서 분리 호출 — setState updater 안에서 부모 setState(onChange) 금지.
   */
  const handleSelect = (levelIndex: number, node: CategoryNode | null): void => {
    const base = levels.slice(0, levelIndex + 1)
    const level = base[levelIndex]
    if (!level) return

    let next: Level[]
    let confirmed: boolean

    if (node == null) {
      // placeholder 재선택 — 이 단계 및 하위 reset(미확정).
      next = base.slice()
      next[levelIndex] = { ...level, selectedId: null, selectedLabel: null }
      confirmed = false
    } else if (node.leaf) {
      // leaf 확정 — 이후 단계 제거.
      next = base.slice()
      next[levelIndex] = { ...level, selectedId: node.id, selectedLabel: node.name }
      confirmed = true
    } else {
      // 비-leaf — 다음 단계(자식 조회) 추가(미확정).
      const updated = base.slice()
      updated[levelIndex] = {
        ...level,
        selectedId: node.id,
        selectedLabel: node.name,
      }
      next = [
        ...updated,
        { parentId: node.id, selectedId: null, selectedLabel: null },
      ]
      confirmed = false
    }

    setLevels(next)

    const pathLabels = next
      .map((l) => l.selectedLabel)
      .filter((l): l is string => l != null)
    onChange(confirmed ? (node?.id ?? '') : '', pathLabels)
  }

  return (
    <div className="flex flex-col gap-2">
      {levels.map((level, idx) => (
        <CascaderLevel
          key={`${marketId}-${level.parentId ?? 'root'}-${idx}`}
          marketId={marketId}
          marketAccountId={marketAccountId}
          marketLabel={marketLabel}
          depth={idx + 1}
          parentId={level.parentId}
          selectedId={level.selectedId}
          onSelect={(node) => handleSelect(idx, node)}
        />
      ))}
    </div>
  )
}

interface CascaderLevelProps {
  marketId: MarketId
  marketAccountId: string
  marketLabel: string
  depth: number
  parentId: string | null
  selectedId: string | null
  onSelect: (node: CategoryNode | null) => void
}

/** 단일 단계 — useMarketCategoryChildren 4상태 렌더. */
function CascaderLevel({
  marketId,
  marketAccountId,
  marketLabel,
  depth,
  parentId,
  selectedId,
  onSelect,
}: CascaderLevelProps): JSX.Element {
  const t = ko.markets.category
  const { data, isLoading, isError, error } = useMarketCategoryChildren(
    marketId,
    marketAccountId,
    parentId,
  )

  // 네이버 등 미지원 → fallback 안내 카드(첫 단계에서만 발생).
  if (error instanceof CategoryFetchError && error.code === 'category_not_supported') {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-dashed border-border-strong bg-surface-subtle p-3">
        <p className="text-[12.5px] font-semibold text-text-secondary">
          {t.notSupportedTitle}
        </p>
        <p className="text-[11.5px] text-text-tertiary">{t.notSupportedHint}</p>
      </div>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-9 w-full" aria-label={t.loading} />
  }

  if (isError) {
    const details = error instanceof Error ? error.message : undefined
    return (
      <ErrorMessage message={t.error} {...(details ? { details } : {})} />
    )
  }

  const nodes = data ?? []
  const isRoot = parentId == null
  const ariaLabel = isRoot
    ? t.rootAriaLabel(marketLabel)
    : t.childAriaLabel(marketLabel, depth)

  // empty — 자식 0개(사실상 최하위). 안내만(상위 단계의 leaf 미표기 마켓 방어).
  if (nodes.length === 0) {
    return (
      <p
        role="status"
        className="rounded-md border border-dashed border-border bg-surface-subtle px-3 py-2 text-[11.5px] text-text-tertiary"
      >
        {t.empty}
      </p>
    )
  }

  return (
    <select
      aria-label={ariaLabel}
      className={cn(SELECT_CLASS)}
      value={selectedId ?? ''}
      onChange={(e) => {
        const picked = nodes.find((n) => n.id === e.target.value) ?? null
        onSelect(picked)
      }}
    >
      <option value="">{isRoot ? t.rootPlaceholder : t.childPlaceholder}</option>
      {nodes.map((node) => (
        <option key={node.id} value={node.id}>
          {node.name}
          {node.leaf ? '' : ' ›'}
        </option>
      ))}
    </select>
  )
}
