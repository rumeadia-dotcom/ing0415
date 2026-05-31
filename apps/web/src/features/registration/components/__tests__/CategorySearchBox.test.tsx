import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

/**
 * CategorySearchBox 단위 테스트 (category-sync.md §6, 추천 Phase 1).
 * 5상태: idle(<2자)/loading/building/empty/ready + 키보드 ↑↓/Enter + onPick(code, pathLabels).
 * useCategorySearch 는 mock — 쿼리 길이에 따른 패널 노출/상태 분기만 검증.
 */

const useCategorySearchMock = vi.fn()
vi.mock('../../hooks/useCategorySearch', () => ({
  useCategorySearch: (...args: unknown[]) => useCategorySearchMock(...args),
}))

import { CategorySearchBox } from '../CategorySearchBox'

const HIT = {
  code: '300',
  name: '티셔츠',
  pathText: '패션 > 여성 > 티셔츠',
  pathLabels: ['패션', '여성', '티셔츠'],
}

interface HookReturn {
  data?: { status: 'ready' | 'building' | 'unsupported'; hits: typeof HIT[] }
  isFetching: boolean
}

function setup(hookReturn: HookReturn) {
  useCategorySearchMock.mockReturnValue(hookReturn)
  const onPick = vi.fn()
  render(
    <CategorySearchBox
      marketId="coupang"
      marketAccountId="acc-1"
      marketLabel="쿠팡"
      onPick={onPick}
    />,
  )
  return { onPick }
}

function typeQuery(value: string): void {
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value } })
}

beforeEach(() => {
  useCategorySearchMock.mockReset()
})

describe('CategorySearchBox', () => {
  it('idle: <2자 → 결과 패널/리스트박스 없음', () => {
    setup({ data: undefined, isFetching: false })
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    typeQuery('티') // 1자 → 여전히 idle
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('ready: hits 표시 + 클릭 → onPick(code, pathLabels)', () => {
    const { onPick } = setup({ data: { status: 'ready', hits: [HIT] }, isFetching: false })
    typeQuery('티셔')
    const option = screen.getByRole('option', { name: /티셔츠/ })
    expect(option).toBeInTheDocument()
    fireEvent.click(option)
    expect(onPick).toHaveBeenCalledWith('300', ['패션', '여성', '티셔츠'])
  })

  it('building: 색인 준비중 안내 노출 (옵션 없음)', () => {
    setup({ data: { status: 'building', hits: [] }, isFetching: false })
    typeQuery('티셔')
    expect(screen.getByText(/색인 준비 중/)).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('empty: ready인데 hits 0 → 일치 없음 안내', () => {
    setup({ data: { status: 'ready', hits: [] }, isFetching: false })
    typeQuery('없는카테고리')
    expect(screen.getByText(/일치하는 카테고리가 없습니다/)).toBeInTheDocument()
  })

  it('키보드: ArrowDown → Enter 로 활성 항목 선택', () => {
    const { onPick } = setup({ data: { status: 'ready', hits: [HIT] }, isFetching: false })
    typeQuery('티셔')
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledWith('300', ['패션', '여성', '티셔츠'])
  })
})
