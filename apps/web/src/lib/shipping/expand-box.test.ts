import { describe, it, expect } from 'vitest'
import { expandBoxToTiers, describeTiers } from './expand-box'

describe('expandBoxToTiers (web preview)', () => {
  it('박스 구간 전개', () => {
    expect(expandBoxToTiers({ qtyPerBox: 12, feePerBox: 2500 }, 3)).toEqual([
      { minQty: 1, maxQty: 12, fee: 2500 },
      { minQty: 13, maxQty: 24, fee: 5000 },
      { minQty: 25, maxQty: null, fee: 7500 },
    ])
  })
  it('잘못된 입력은 빈 배열 (UI 프리뷰는 throw 대신 graceful)', () => {
    expect(expandBoxToTiers({ qtyPerBox: 0, feePerBox: 2500 }, 3)).toEqual([])
    expect(expandBoxToTiers({ qtyPerBox: 12, feePerBox: -1 }, 3)).toEqual([])
  })
})

describe('describeTiers', () => {
  it('미리보기 문자열 — 마지막은 "이상"', () => {
    const s = describeTiers({ qtyPerBox: 12, feePerBox: 2500 }, 3)
    expect(s).toBe('1~12개 2,500원 · 13~24개 5,000원 · 25개 이상 7,500원')
  })
  it('빈 입력 → 빈 문자열', () => {
    expect(describeTiers({ qtyPerBox: 0, feePerBox: 2500 }, 3)).toBe('')
  })
})
