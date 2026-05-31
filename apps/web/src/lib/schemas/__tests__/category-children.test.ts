import { describe, expect, it } from 'vitest'
import {
  CategoryChildrenRequestSchema,
  CategoryChildrenResponseSchema,
} from '@/lib/schemas'

/**
 * 카테고리 lazy cascading req/res 스키마 (category-sync.md §5).
 * R-001 zod 규약: pass ≥1 + fail ≥1.
 */
describe('CategoryChildrenRequestSchema', () => {
  it('pass: parentId 생략(루트) 허용', () => {
    const parsed = CategoryChildrenRequestSchema.parse({
      marketId: 'coupang',
      marketAccountId: '00000000-0000-4000-8000-000000000001',
    })
    expect(parsed.parentId).toBeUndefined()
  })

  it('pass: parentId=null(루트 명시) 허용', () => {
    const parsed = CategoryChildrenRequestSchema.parse({
      marketId: 'gmarket',
      marketAccountId: '00000000-0000-4000-8000-000000000001',
      parentId: null,
    })
    expect(parsed.parentId).toBeNull()
  })

  it('fail: marketAccountId 가 uuid 가 아니면 거부', () => {
    expect(() =>
      CategoryChildrenRequestSchema.parse({
        marketId: 'coupang',
        marketAccountId: 'not-a-uuid',
      }),
    ).toThrow()
  })

  it('fail: 알 수 없는 marketId 거부', () => {
    expect(() =>
      CategoryChildrenRequestSchema.parse({
        marketId: 'unknown-market',
        marketAccountId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toThrow()
  })
})

describe('CategoryChildrenResponseSchema', () => {
  it('pass: leaf 노드 배열 parse', () => {
    const parsed = CategoryChildrenResponseSchema.parse({
      nodes: [
        {
          id: '1001',
          name: '여성의류',
          depth: 1,
          leaf: false,
          parentId: null,
          children: [],
        },
      ],
    })
    expect(parsed.nodes).toHaveLength(1)
    expect(parsed.nodes[0]?.leaf).toBe(false)
  })

  it('fail: 노드 name 누락 거부', () => {
    expect(() =>
      CategoryChildrenResponseSchema.parse({
        nodes: [{ id: '1', depth: 1, leaf: true, parentId: null, children: [] }],
      }),
    ).toThrow()
  })
})
