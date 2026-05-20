import { describe, it, expect, beforeEach } from 'vitest'
import { useRegisterFormStore } from '../store/useRegisterFormStore'

describe('useRegisterFormStore', () => {
  beforeEach(() => {
    useRegisterFormStore.getState().clear()
  })

  it('초기 상태는 모두 null/빈 배열', () => {
    const s = useRegisterFormStore.getState()
    expect(s.productId).toBeNull()
    expect(s.step1).toBeNull()
    expect(s.images).toEqual([])
    expect(s.selections).toEqual([])
    expect(s.mappings).toEqual([])
  })

  it('setStep1 + setImages + setSelections + setMappings 반영', () => {
    const { setStep1, setImages, setSelections, setMappings, setProductId } = useRegisterFormStore.getState()
    setProductId('00000000-0000-0000-0000-000000000pid')
    setStep1({
      name: '테스트',
      price: 15000,
      originalPrice: null,
      brand: null,
      manufacturer: null,
      descriptionHtml: null,
      baseCategoryId: 'cat-1',
      shippingPolicyId: '00000000-0000-0000-0000-000000000sp1',
    })
    setImages([
      {
        id: '00000000-0000-0000-0000-000000000img',
        storagePath: 's/p/i.jpg',
        role: 'main',
        sortOrder: 0,
        width: 1024,
        height: 1024,
        bytes: 1234,
        mimeType: 'image/jpeg',
        hashSha256: 'a'.repeat(64),
      },
    ])
    setSelections([{ marketId: 'naver', marketAccountId: '00000000-0000-0000-0000-000000000ma1' }])
    setMappings([
      {
        marketId: 'naver',
        marketCategoryCode: '50000001',
        marketNameOverride: null,
        marketPriceOverride: null,
        marketOptions: {},
      },
    ])

    const s = useRegisterFormStore.getState()
    expect(s.productId).toBe('00000000-0000-0000-0000-000000000pid')
    expect(s.step1?.name).toBe('테스트')
    expect(s.images).toHaveLength(1)
    expect(s.selections).toHaveLength(1)
    expect(s.mappings).toHaveLength(1)
  })

  it('clear() 는 모든 필드를 초기값으로', () => {
    const { setStep1, clear } = useRegisterFormStore.getState()
    setStep1({
      name: 'x',
      price: 1000,
      originalPrice: null,
      brand: null,
      manufacturer: null,
      descriptionHtml: null,
      baseCategoryId: 'c',
      shippingPolicyId: '00000000-0000-0000-0000-000000000sp2',
    })
    clear()
    expect(useRegisterFormStore.getState().step1).toBeNull()
  })
})
