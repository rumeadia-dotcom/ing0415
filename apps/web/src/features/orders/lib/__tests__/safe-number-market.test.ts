import { describe, it, expect } from 'vitest'
import { isSafeNumberMarket } from '../safe-number-market'

describe('isSafeNumberMarket', () => {
  it('coupang 은 안심번호 마켓이다 (v5 정책)', () => {
    expect(isSafeNumberMarket('coupang')).toBe(true)
  })

  it('naver 는 안심번호 마켓이 아니다 (실 전화번호 노출)', () => {
    expect(isSafeNumberMarket('naver')).toBe(false)
  })

  it('11st / gmarket / auction 도 현재 안심번호 마켓이 아니다', () => {
    expect(isSafeNumberMarket('11st')).toBe(false)
    expect(isSafeNumberMarket('gmarket')).toBe(false)
    expect(isSafeNumberMarket('auction')).toBe(false)
  })
})
