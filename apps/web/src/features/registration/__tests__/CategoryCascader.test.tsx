/**
 * CategoryCascader 단위 테스트 (category-sync.md §6.2 / §8).
 *
 * 검증:
 *  ① 단계 진행 — leaf=false 선택 시 다음 단계(자식 조회) 추가
 *  ② leaf=true 선택 시 onChange(code, pathLabels) 확정 emit
 *  ③ 상위 단계 재선택 시 하위 단계 reset
 *  ④ error / empty 상태 렌더
 *  ⑤ category_not_supported(네이버) → fallback 안내
 *
 * useMarketCategoryChildren 을 mock — parentId 별 정적 children 으로 단계 동작을 제어.
 */
import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CategoryNode } from '@/lib/schemas'
import { CategoryFetchError } from '../api/category-api'
import { ko } from '@/locales/ko'

const childrenHookMock = vi.fn()

vi.mock('../hooks/useMarketCategoryChildren', () => ({
  useMarketCategoryChildren: (
    marketId: string | null,
    marketAccountId: string | null,
    parentId: string | null,
  ) => childrenHookMock(marketId, marketAccountId, parentId),
}))

import { CategoryCascader } from '../components/CategoryCascader'

const ACCOUNT_ID = '00000000-0000-0000-0000-0000000000a1'

function node(over: Partial<CategoryNode> & { id: string; name: string }): CategoryNode {
  return {
    depth: 1,
    leaf: false,
    parentId: null,
    children: [],
    ...over,
  }
}

/** 정상 응답 헬퍼 — data 배열. */
function ok(nodes: CategoryNode[]) {
  return { data: nodes, isLoading: false, isError: false, error: null }
}

beforeEach(() => {
  childrenHookMock.mockReset()
})

describe('CategoryCascader', () => {
  it('① 단계 진행: leaf=false 선택 시 다음 단계(자식 조회) 추가 + onChange 미확정', async () => {
    // 루트(null): 비-leaf '패션', 자식('1001'): leaf '여성의류'
    childrenHookMock.mockImplementation((_m, _a, parentId: string | null) => {
      if (parentId == null) {
        return ok([node({ id: '1001', name: '패션', leaf: false, depth: 1 })])
      }
      return ok([
        node({ id: '2001', name: '여성의류', leaf: true, depth: 2, parentId: '1001' }),
      ])
    })

    const onChange = vi.fn()
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={onChange}
      />,
    )

    // 처음엔 단계 1개 (대분류 select)
    const rootSelect = screen.getByLabelText(ko.markets.category.rootAriaLabel('쿠팡'))
    expect(rootSelect).toBeInTheDocument()

    await userEvent.selectOptions(rootSelect, '1001')

    // 비-leaf 선택 → 미확정 통지(code='')
    expect(onChange).toHaveBeenLastCalledWith('', ['패션'])
    // 2단계 select 가 추가됨 (자식 조회)
    expect(
      screen.getByLabelText(ko.markets.category.childAriaLabel('쿠팡', 2)),
    ).toBeInTheDocument()
    // hook 이 parentId='1001' 로 호출됨
    expect(childrenHookMock).toHaveBeenCalledWith('coupang', ACCOUNT_ID, '1001')
  })

  it('② leaf=true 선택 시 onChange(code, pathLabels) 확정 emit', async () => {
    childrenHookMock.mockImplementation((_m, _a, parentId: string | null) => {
      if (parentId == null) {
        return ok([node({ id: '1001', name: '패션', leaf: false, depth: 1 })])
      }
      return ok([
        node({ id: '2001', name: '여성의류', leaf: true, depth: 2, parentId: '1001' }),
      ])
    })

    const onChange = vi.fn()
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={onChange}
      />,
    )

    await userEvent.selectOptions(
      screen.getByLabelText(ko.markets.category.rootAriaLabel('쿠팡')),
      '1001',
    )
    await userEvent.selectOptions(
      screen.getByLabelText(ko.markets.category.childAriaLabel('쿠팡', 2)),
      '2001',
    )

    // leaf 확정 → code + 전체 경로
    expect(onChange).toHaveBeenLastCalledWith('2001', ['패션', '여성의류'])
  })

  it('③ 상위 단계 재선택 시 하위 단계 reset', async () => {
    childrenHookMock.mockImplementation((_m, _a, parentId: string | null) => {
      if (parentId == null) {
        return ok([
          node({ id: '1001', name: '패션', leaf: false, depth: 1 }),
          node({ id: '1002', name: '도서', leaf: true, depth: 1 }),
        ])
      }
      return ok([
        node({ id: '2001', name: '여성의류', leaf: true, depth: 2, parentId: '1001' }),
      ])
    })

    const onChange = vi.fn()
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={onChange}
      />,
    )

    const rootSelect = screen.getByLabelText(ko.markets.category.rootAriaLabel('쿠팡'))
    // 비-leaf '패션' 선택 → 2단계 생김
    await userEvent.selectOptions(rootSelect, '1001')
    expect(
      screen.getByLabelText(ko.markets.category.childAriaLabel('쿠팡', 2)),
    ).toBeInTheDocument()

    // 상위에서 leaf '도서' 재선택 → 하위 단계 제거 + 확정
    await userEvent.selectOptions(rootSelect, '1002')
    expect(
      screen.queryByLabelText(ko.markets.category.childAriaLabel('쿠팡', 2)),
    ).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith('1002', ['도서'])
  })

  it('④ error 상태 → ErrorMessage 렌더', () => {
    childrenHookMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    })
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(ko.markets.category.error)).toBeInTheDocument()
  })

  it('④ empty 상태 → 최하위 안내 렌더', () => {
    childrenHookMock.mockReturnValue(ok([]))
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(ko.markets.category.empty)).toBeInTheDocument()
  })

  it('⑥ 비-root 단계 자식 0개 → 직전 부모를 자동 확정', async () => {
    childrenHookMock.mockImplementation((_m, _a, parentId: string | null) => {
      if (parentId == null) {
        return ok([node({ id: '1001', name: '패션', leaf: false, depth: 1 })])
      }
      return ok([]) // 드릴 결과 자식 없음 → '패션'이 사실상 말단
    })

    const onChange = vi.fn()
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={onChange}
      />,
    )

    await userEvent.selectOptions(
      screen.getByLabelText(ko.markets.category.rootAriaLabel('쿠팡')),
      '1001',
    )

    expect(onChange).toHaveBeenLastCalledWith('1001', ['패션'])
    // 단일 발화 보장 — empty 자식 로드가 onChange 를 한 번만 확정해야 한다.
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByLabelText(ko.markets.category.childAriaLabel('쿠팡', 2)),
    ).not.toBeInTheDocument()
  })

  it('⑦ root(첫 단계) 0개는 자동 확정하지 않는다 (확정 대상 부모 없음)', () => {
    childrenHookMock.mockReturnValue(ok([]))
    const onChange = vi.fn()
    render(
      <CategoryCascader
        marketId="coupang"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={onChange}
      />,
    )
    expect(screen.getByText(ko.markets.category.empty)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('⑧ StrictMode + 로딩→empty 비동기 전환에서도 부모를 정확히 1회 확정', async () => {
    // 루트: 비-leaf '패션'. 자식: 처음 로딩(isLoading) → 이후 빈 배열.
    let childrenLoaded = false
    childrenHookMock.mockImplementation((_m, _a, parentId: string | null) => {
      if (parentId == null) {
        return ok([node({ id: '1001', name: '패션', leaf: false, depth: 1 })])
      }
      // 비-root: 첫 렌더는 로딩, 이후 빈 배열(말단).
      if (!childrenLoaded) {
        childrenLoaded = true
        return { data: undefined, isLoading: true, isError: false, error: null }
      }
      return ok([])
    })

    const onChange = vi.fn()
    render(
      <StrictMode>
        <CategoryCascader
          marketId="coupang"
          marketAccountId={ACCOUNT_ID}
          value={null}
          onChange={onChange}
        />
      </StrictMode>,
    )

    await userEvent.selectOptions(
      screen.getByLabelText(ko.markets.category.rootAriaLabel('쿠팡')),
      '1001',
    )

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('1001', ['패션']))
    // StrictMode 이중 호출 + 재렌더에도 확정은 정확히 1회.
    expect(onChange.mock.calls.filter((c) => c[0] === '1001')).toHaveLength(1)
  })

  it('⑤ category_not_supported(네이버) → fallback 안내', () => {
    childrenHookMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new CategoryFetchError({
        code: 'category_not_supported',
        message: '네이버 미지원',
      }),
    })
    render(
      <CategoryCascader
        marketId="naver"
        marketAccountId={ACCOUNT_ID}
        value={null}
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByText(ko.markets.category.notSupportedTitle),
    ).toBeInTheDocument()
  })
})
