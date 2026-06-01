import { useId, useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui'
import { useCategorySearch } from '../hooks/useCategorySearch'
import { ko } from '@/locales/ko'
import { cn } from '@/lib/utils'
import type { MarketId } from '@/lib/schemas'

interface CategorySearchBoxProps {
  marketId: MarketId
  marketAccountId: string
  /** 스크린리더 aria-label 에 쓰는 마켓 표시명(예: '쿠팡'). */
  marketLabel: string
  /** leaf 선택 — 코드 + 경로 라벨(대 › 중 › 소). */
  onPick: (code: string, pathLabels: string[]) => void
}

/**
 * CategorySearchBox — 카테고리명 타이핑 → 전역 인덱스 leaf 부분일치 검색 (category-sync.md §6).
 *
 * 5상태: idle(<2자, 패널 없음) / loading / building(ESM 색인 준비중) / empty / ready(listbox).
 * 키보드: ↑↓ 로 활성 이동, Enter 로 선택, Esc 로 해제. combobox+listbox ARIA.
 * 토큰만 사용, 옵션 행 min-h 44px(터치). onPick 후 입력 초기화.
 */
export function CategorySearchBox({
  marketId,
  marketAccountId,
  marketLabel,
  onPick,
}: CategorySearchBoxProps): JSX.Element {
  const t = ko.markets.category
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const listboxId = useId()

  const result = useCategorySearch(marketId, marketAccountId, query)
  const status = result.data?.status
  const hits = result.data?.hits ?? []

  const showPanel = query.trim().length >= 2
  const loading = result.isFetching && status !== 'building'

  const pick = (index: number): void => {
    const hit = hits[index]
    if (!hit) return
    onPick(hit.code, hit.pathLabels)
    setQuery('')
    setActiveIndex(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      setActiveIndex(-1)
      return
    }
    if (!showPanel || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      pick(activeIndex)
    }
  }

  return (
    <div className="relative">
      <Input
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        aria-label={t.searchAriaLabel(marketLabel)}
        placeholder={t.searchPlaceholder}
        className="min-h-[44px]"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActiveIndex(-1)
        }}
        onKeyDown={onKeyDown}
      />

      {showPanel && (
        <div className="mt-1.5 rounded-md border border-border bg-surface p-1 shadow-sm">
          {loading && (
            <p className="px-2 py-2 text-[12px] text-text-tertiary" role="status">
              {t.loading}
            </p>
          )}
          {!loading && status === 'building' && (
            <p className="px-2 py-2 text-[12px] text-text-secondary" role="status">
              {t.searchBuilding}
            </p>
          )}
          {!loading && status === 'ready' && hits.length === 0 && (
            <p className="px-2 py-2 text-[12px] text-text-tertiary" role="status">
              {t.searchEmpty}
            </p>
          )}
          {hits.length > 0 && (
            <ul
              role="listbox"
              id={listboxId}
              aria-label={t.searchAriaLabel(marketLabel)}
              className="flex flex-col"
            >
              {hits.map((hit, i) => (
                // ARIA combobox: 키보드 동선은 input(onKeyDown)+aria-activedescendant 로
                // 처리(옵션은 비포커스). 옵션 onClick 은 마우스 affordance 라 키 리스너 불필요.
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={hit.code}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer flex-col justify-center rounded px-2 py-1.5',
                    i === activeIndex ? 'bg-accent-soft' : 'hover:bg-surface-subtle',
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(i)}
                >
                  <span className="text-[13px] font-semibold text-text">{hit.name}</span>
                  <span className="truncate text-[11px] text-text-tertiary">
                    {hit.pathText}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
