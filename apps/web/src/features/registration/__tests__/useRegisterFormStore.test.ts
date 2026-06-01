import { describe, it, expect, beforeEach } from 'vitest'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { DEFAULT_SHIPPING_CONFIG } from '@/lib/schemas/shipping-config'

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
      shippingConfig: DEFAULT_SHIPPING_CONFIG,
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

  // R2: 병렬 업로드 race 방지 — addImage 는 현재 store 상태에 원자적으로 append.
  it('addImage: 첫 장은 main, 이후는 sub 로 누적 (소실 없음)', () => {
    const makeMeta = (id: string) => ({
      id,
      storagePath: `s/p/${id}.jpg`,
      role: 'sub' as const, // 호출자가 어떤 role 을 넣어도 store 가 위치 기준으로 덮어씀
      sortOrder: 0,
      width: 1024,
      height: 1024,
      bytes: 1234,
      mimeType: 'image/jpeg',
      hashSha256: 'a'.repeat(64),
    })
    const { addImage } = useRegisterFormStore.getState()
    addImage(makeMeta('00000000-0000-0000-0000-0000000000a1'))
    addImage(makeMeta('00000000-0000-0000-0000-0000000000a2'))
    addImage(makeMeta('00000000-0000-0000-0000-0000000000a3'))

    const imgs = useRegisterFormStore.getState().images
    expect(imgs).toHaveLength(3)
    expect(imgs[0]?.role).toBe('main')
    expect(imgs[1]?.role).toBe('sub')
    expect(imgs[2]?.role).toBe('sub')
    // 누적 순서 유지
    expect(imgs.map((i) => i.id)).toEqual([
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000a3',
    ])
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
      shippingConfig: DEFAULT_SHIPPING_CONFIG,
    })
    clear()
    expect(useRegisterFormStore.getState().step1).toBeNull()
  })
})
