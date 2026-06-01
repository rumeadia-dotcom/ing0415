import { describe, it, expect } from 'vitest'
import { ShippingConfigSchema, ShippingTemplateSchema } from './shipping-config'

const base = { method: 'parcel', etaDays: 2, payType: 'prepaid', bundleAllowed: false } as const

describe('ShippingConfigSchema', () => {
  it('free 최소 구성 통과', () => {
    expect(ShippingConfigSchema.safeParse({ ...base, feeType: 'free' }).success).toBe(true)
  })
  it('quantity_tiered 인데 box 없으면 실패', () => {
    const r = ShippingConfigSchema.safeParse({ ...base, feeType: 'quantity_tiered' })
    expect(r.success).toBe(false)
  })
  it('quantity_tiered + box 통과', () => {
    const r = ShippingConfigSchema.safeParse({
      ...base, feeType: 'quantity_tiered', box: { qtyPerBox: 12, feePerBox: 2500 },
    })
    expect(r.success).toBe(true)
  })
  it('paid 인데 baseFee<=0 이면 실패', () => {
    expect(ShippingConfigSchema.safeParse({ ...base, feeType: 'paid', baseFee: 0 }).success).toBe(false)
  })
  it('conditional_free 인데 freeThreshold 없으면 실패', () => {
    expect(ShippingConfigSchema.safeParse({ ...base, feeType: 'conditional_free', baseFee: 3000 }).success).toBe(false)
  })
  it('box.qtyPerBox<2 이면 실패 (ESM 첫 구간 2 이상)', () => {
    const r = ShippingConfigSchema.safeParse({
      ...base, feeType: 'quantity_tiered', box: { qtyPerBox: 1, feePerBox: 2500 },
    })
    expect(r.success).toBe(false)
  })
})

describe('ShippingTemplateSchema', () => {
  it('config + name + isDefault 통과', () => {
    const r = ShippingTemplateSchema.safeParse({
      name: '기본', isDefault: true, config: { ...base, feeType: 'free' },
    })
    expect(r.success).toBe(true)
  })
  it('name 누락 실패', () => {
    expect(
      ShippingTemplateSchema.safeParse({ isDefault: false, config: { ...base, feeType: 'free' } }).success,
    ).toBe(false)
  })
})
