import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/**
 * RecentCategoryChips 단위 테스트 (category-sync.md §6, 추천 Phase 1).
 * 칩 표시=leaf 라벨, title=pathText, 클릭→onPick(code, pathLabels). 0개면 null.
 */

const useRecentCategoriesMock = vi.fn()
vi.mock('../../hooks/useRecentCategories', () => ({
  useRecentCategories: (...args: unknown[]) => useRecentCategoriesMock(...args),
}))

import { RecentCategoryChips } from '../RecentCategoryChips'

const HITS = [
  { code: '300', name: '티셔츠', pathText: '패션 > 여성 > 티셔츠', pathLabels: ['패션', '여성', '티셔츠'] },
  { code: '410', name: '전기밥솥', pathText: '가전 > 주방 > 전기밥솥', pathLabels: ['가전', '주방', '전기밥솥'] },
]

function setup(data: typeof HITS | undefined) {
  useRecentCategoriesMock.mockReturnValue({ data })
  const onPick = vi.fn()
  const result = render(
    <RecentCategoryChips marketId="coupang" marketLabel="쿠팡" onPick={onPick} />,
  )
  return { onPick, ...result }
}

beforeEach(() => {
  useRecentCategoriesMock.mockReset()
})

describe('RecentCategoryChips', () => {
  it('0개 → null 렌더 (아무것도 표시 안 함)', () => {
    const { container } = setup([])
    expect(container.firstChild).toBeNull()
  })

  it('data 없음(undefined) → null', () => {
    const { container } = setup(undefined)
    expect(container.firstChild).toBeNull()
  })

  it('칩 표시=leaf 라벨 + title=pathText + 클릭 onPick(code, pathLabels)', () => {
    const { onPick } = setup(HITS)
    const chip = screen.getByRole('button', { name: '티셔츠' })
    expect(chip).toHaveAttribute('title', '패션 > 여성 > 티셔츠')
    fireEvent.click(chip)
    expect(onPick).toHaveBeenCalledWith('300', ['패션', '여성', '티셔츠'])
  })

  it('여러 칩 모두 렌더', () => {
    setup(HITS)
    expect(screen.getByRole('button', { name: '티셔츠' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '전기밥솥' })).toBeInTheDocument()
  })
})
