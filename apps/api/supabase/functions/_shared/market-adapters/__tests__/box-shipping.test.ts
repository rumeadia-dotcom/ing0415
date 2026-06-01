import { describe, it, expect } from 'vitest'
import {
  expandBoxToTiers,
  elevenStBoxToFields,
  coupangBoxFallback,
  naverBoxToDeliveryFee,
  NAVER_QTY_FEE_TYPE,
  esmBoxToDetails,
  effectiveSingleFee,
} from '../box-shipping.ts'

const BOX = { qtyPerBox: 12, feePerBox: 2500 }

describe('expandBoxToTiers', () => {
  it('k번째 박스 = k×feePerBox, 마지막 구간 maxQty=null(open-ended)', () => {
    const tiers = expandBoxToTiers(BOX, 3)
    expect(tiers).toEqual([
      { minQty: 1, maxQty: 12, fee: 2500 },
      { minQty: 13, maxQty: 24, fee: 5000 },
      { minQty: 25, maxQty: null, fee: 7500 },
    ])
  })
  it('maxTiers 1 이면 전부 open-ended 단일 구간', () => {
    expect(expandBoxToTiers(BOX, 1)).toEqual([{ minQty: 1, maxQty: null, fee: 2500 }])
  })
  it('qtyPerBox<1 또는 feePerBox<0 이면 throw', () => {
    expect(() => expandBoxToTiers({ qtyPerBox: 0, feePerBox: 2500 }, 5)).toThrow()
    expect(() => expandBoxToTiers({ qtyPerBox: 12, feePerBox: -1 }, 5)).toThrow()
  })
  it('feePerBox 가 비정수면 throw (zod int() 계약 일치)', () => {
    expect(() => expandBoxToTiers({ qtyPerBox: 12, feePerBox: 2.5 }, 5)).toThrow()
  })
  it('maxTiers 비유한(NaN/Infinity) 이면 기본 10구간으로 폴백', () => {
    expect(expandBoxToTiers(BOX, Number.NaN)).toHaveLength(10)
    expect(expandBoxToTiers(BOX, Number.POSITIVE_INFINITY)).toHaveLength(10)
  })
})

describe('elevenStBoxToFields (11번가 04 — dlvCnt1/dlvCnt2/dlvCst3)', () => {
  it('기본 maxTiers=10 → dlvCnt1 10개, dlvCnt2 9개, dlvCst3 10개', () => {
    const f = elevenStBoxToFields(BOX)
    expect(f.dlvCstInstBasiCd).toBe('04')
    expect(f.dlvCnt1.split('^')).toHaveLength(10)
    expect(f.dlvCnt2.split('^')).toHaveLength(9)
    expect(f.dlvCst3.split('^')).toHaveLength(10)
    expect(f.dlvCnt1.split('^')[0]).toBe('1')
    expect(f.dlvCnt1.split('^')[1]).toBe('13')
    expect(f.dlvCnt2.split('^')[0]).toBe('12')
    expect(f.dlvCst3.split('^')[0]).toBe('2500')
    expect(f.dlvCst3.split('^')[9]).toBe('25000') // 10박스 = 10×2500
  })
})

describe('coupangBoxFallback (미지원 → 박스당 단일 + 경고)', () => {
  it('shippingFee=feePerBox, warning 플래그', () => {
    const r = coupangBoxFallback(BOX)
    expect(r.shippingFee).toBe(2500)
    expect(r.warning.code).toBe('shipping_tier_unsupported')
    expect(r.warning.message).toContain('쿠팡')
  })
})

describe('naverBoxToDeliveryFee (변환기 — 아직 어댑터 미wiring)', () => {
  it('repeatQuantity=qtyPerBox, baseFee=feePerBox', () => {
    const r = naverBoxToDeliveryFee(BOX)
    expect(r.repeatQuantity).toBe(12)
    expect(r.baseFee).toBe(2500)
    expect(r.deliveryFeeType).toBe(NAVER_QTY_FEE_TYPE) // C3 enum 확정 시 실제 리터럴로 교체
  })
})

describe('esmBoxToDetails (변환기 — 아직 어댑터 미wiring, 최대 5단계)', () => {
  it('feeType=4, details 최대 5개 {Condition, FeeAmnt}', () => {
    const r = esmBoxToDetails(BOX)
    expect(r.feeType).toBe('4')
    expect(r.details).toHaveLength(5)
    expect(r.details[0]).toEqual({ Condition: 1, FeeAmnt: 2500 })
    expect(r.details[4]).toEqual({ Condition: 49, FeeAmnt: 12500 })
  })
})

describe('effectiveSingleFee', () => {
  it('quantity_tiered → 1박스 요금', () => {
    expect(
      effectiveSingleFee({
        feeType: 'quantity_tiered',
        box: { qtyPerBox: 12, feePerBox: 2500 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).toBe(2500)
  })
  it('free → 0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(effectiveSingleFee({ feeType: 'free' } as any)).toBe(0)
  })
  it('paid → baseFee', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(effectiveSingleFee({ feeType: 'paid', baseFee: 3000 } as any)).toBe(3000)
  })
  it('null → 0', () => {
    expect(effectiveSingleFee(null)).toBe(0)
  })
})
