import { describe, expect, it } from 'vitest'
import { stripNsPrefix } from '@/lib/markets/xml'

/**
 * Cross-market XML 파서 유틸 (PR-6, §8-4 — 11번가 map 인라인에서 공용 추출).
 *
 * R-001: pass + fail/엣지. 11번가 어댑터의 기존 stripNsPrefix 동작과 동일(회귀 0).
 */

describe('stripNsPrefix — ns2 네임스페이스 제거 (공용 유틸)', () => {
  it('단일 선행 prefix 제거 (중첩/배열 재귀)', () => {
    const input = {
      'ns2:categorys': {
        'ns2:category': [
          { 'ns2:dispNo': '1', 'ns2:dispNm': '패션' },
          { 'ns2:dispNo': '2', 'ns2:dispNm': '식품' },
        ],
      },
    }
    expect(stripNsPrefix(input)).toEqual({
      categorys: {
        category: [
          { dispNo: '1', dispNm: '패션' },
          { dispNo: '2', dispNm: '식품' },
        ],
      },
    })
  })

  it('prefix 없는 키는 그대로', () => {
    expect(stripNsPrefix({ productNo: '52844137', resultCode: '200' })).toEqual({
      productNo: '52844137',
      resultCode: '200',
    })
  })

  it('단일 객체 형태도 prefix 제거', () => {
    expect(stripNsPrefix({ 'ns2:result_message': 'SUCCESS' })).toEqual({
      result_message: 'SUCCESS',
    })
  })

  it('원본 비변형 (새 객체 반환)', () => {
    const src = { 'ns2:a': { 'ns2:b': 1 } }
    const out = stripNsPrefix(src) as Record<string, unknown>
    expect(src).toEqual({ 'ns2:a': { 'ns2:b': 1 } }) // 원본 유지
    expect(out).toEqual({ a: { b: 1 } })
  })

  it('원시값/null/배열 엣지 (fail-safe)', () => {
    expect(stripNsPrefix('SUCCESS')).toBe('SUCCESS')
    expect(stripNsPrefix(null)).toBe(null)
    expect(stripNsPrefix(123)).toBe(123)
    expect(stripNsPrefix([])).toEqual([])
  })
})
