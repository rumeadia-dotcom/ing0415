import { Button } from '@/components/ui'
import { useRecentCategories } from '../hooks/useRecentCategories'
import { ko } from '@/locales/ko'
import type { MarketId } from '@/lib/schemas'

interface RecentCategoryChipsProps {
  marketId: MarketId
  /** 스크린리더 aria-label 용 마켓 표시명. */
  marketLabel: string
  onPick: (code: string, pathLabels: string[]) => void
}

/**
 * RecentCategoryChips — 셀러의 마켓별 최근 사용 카테고리 칩 (category-sync.md §6).
 *
 * 표시는 leaf 라벨(경로 마지막), title 에 전체 경로(대 > 중 > 소). 0개면 null(렌더 없음).
 * 칩은 클릭 시 즉시 폼 갱신(서버 변경 없음) → 검색·필터류 Button(outline). 최대 6개(RPC 제한).
 */
export function RecentCategoryChips({
  marketId,
  marketLabel,
  onPick,
}: RecentCategoryChipsProps): JSX.Element | null {
  const t = ko.markets.category
  const { data } = useRecentCategories(marketId)
  const chips = (data ?? []).slice(0, 6)

  if (chips.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-text-tertiary">{t.recentTitle}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label={t.recentAriaLabel(marketLabel)}>
        {chips.map((hit) => {
          const leaf = hit.pathLabels[hit.pathLabels.length - 1] ?? hit.name
          return (
            <li key={hit.code}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                title={hit.pathText}
                onClick={() => onPick(hit.code, hit.pathLabels)}
              >
                {leaf}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
