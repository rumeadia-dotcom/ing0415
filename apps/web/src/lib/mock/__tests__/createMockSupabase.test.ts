import { describe, it, expect } from 'vitest'
import {
  createMockSupabase,
  registerMockImageBlob,
} from '../createMockSupabase'

describe('createMockSupabase.functions.invoke', () => {
  const supabase = createMockSupabase()

  it('image-upload-url — uploadUrl / imageId / originalPath / expiresAt 반환', async () => {
    const { data, error } = await supabase.functions.invoke('image-upload-url', {
      body: {
        productId: '00000000-0000-0000-0000-000000000aaa',
        filename: 'x.png',
        contentType: 'image/png',
      },
    })
    expect(error).toBeNull()
    expect(data.uploadUrl).toMatch(/^https:\/\/mock\.local\/storage\//)
    expect(data.imageId).toMatch(/^[0-9a-f-]{36}$/)
    expect(data.originalPath).toMatch(/^mock\/00000000-0000-0000-0000-000000000aaa\//)
    expect(typeof data.token).toBe('string')
    expect(typeof data.expiresAt).toBe('string')
  })

  it('image-register — status=uploaded + role(main/sub) 반환', async () => {
    const imageId = '00000000-0000-0000-0000-000000000bbb'
    const r1 = await supabase.functions.invoke('image-register', {
      body: { imageId, position: 0 },
    })
    expect(r1.data.imageId).toBe(imageId)
    expect(r1.data.status).toBe('uploaded')
    expect(r1.data.role).toBe('main')

    const r2 = await supabase.functions.invoke('image-register', {
      body: { imageId, position: 1 },
    })
    expect(r2.data.role).toBe('sub')
  })

  it('registration-validate — ok/previews(marketIds 길이) 반환', async () => {
    const { data, error } = await supabase.functions.invoke('registration-validate', {
      body: {
        productId: '00000000-0000-0000-0000-000000000ccc',
        marketIds: ['naver', 'coupang', '11st', 'gmarket', 'auction'],
      },
    })
    expect(error).toBeNull()
    expect(data.ok).toBe(true)
    expect(data.issues).toEqual([])
    expect(data.previews).toHaveLength(5)
    expect(data.previews[0]).toMatchObject({
      marketId: 'naver',
      estimatedFee: 0,
    })
  })

  it('registration-start — jobId / status=pending / marketResults 반환', async () => {
    const { data } = await supabase.functions.invoke('registration-start', {
      body: {
        productId: '00000000-0000-0000-0000-000000000ddd',
        marketIds: ['naver', 'coupang'],
      },
    })
    expect(data.jobId).toMatch(/^[0-9a-f-]{36}$/)
    expect(data.status).toBe('pending')
    expect(data.marketResults).toHaveLength(2)
    expect(data.marketResults[0]).toMatchObject({
      marketId: 'naver',
      status: 'pending',
    })
    expect(data.marketResults[0].marketAccountId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('esm-shipping-list — gmarket 계정은 site=G 출하지/발송정책 반환 (PR-E2 조회형)', async () => {
    const { data, error } = await supabase.functions.invoke('esm-shipping-list', {
      body: { marketAccountId: '00000000-0000-4000-8000-000000001003' },
    })
    expect(error).toBeNull()
    expect(data.site).toBe('G')
    expect(data.places.length).toBeGreaterThan(0)
    expect(data.places[0]).toMatchObject({ placeNo: expect.any(String), placeName: expect.any(String) })
    expect(data.dispatchPolicies[0]).toMatchObject({ site: 'G', dispatchPolicyNo: expect.any(String) })
  })

  it('esm-shipping-list — auction 계정은 site=A 로 태깅 (site 분기)', async () => {
    const { data } = await supabase.functions.invoke('esm-shipping-list', {
      body: { marketAccountId: '00000000-0000-4000-8000-000000001004' },
    })
    expect(data.site).toBe('A')
    expect(data.dispatchPolicies[0].site).toBe('A')
  })

  it('unknown name — { data: { ok: true }, error: null } fallback', async () => {
    const { data, error } = await supabase.functions.invoke('something-unknown', {
      body: {},
    })
    expect(error).toBeNull()
    expect(data).toEqual({ ok: true })
  })
})

describe('createMockSupabase.storage.getPublicUrl', () => {
  it('registerMockImageBlob 로 등록된 imageId → blob URL 반환', () => {
    const supabase = createMockSupabase()
    const imageId = '00000000-0000-0000-0000-000000000eee'
    registerMockImageBlob(imageId, 'blob:mock-1')

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(`mock/p/${imageId}`)

    expect(data.publicUrl).toBe('blob:mock-1')
  })

  it('등록되지 않은 path → https://mock.local/public/<path> fallback', () => {
    const supabase = createMockSupabase()
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl('mock/p/unknown-id')

    expect(data.publicUrl).toBe('https://mock.local/public/mock/p/unknown-id')
  })
})
