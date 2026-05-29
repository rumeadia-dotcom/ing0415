/**
 * ESM 상품등록 재작성 단위 테스트 (PR-4).
 *
 * 마스터: docs/architecture/v1/features/esm.md §4.1 / §4.2 / §7 PR-4.
 * 검증:
 *   - buildEsmGoodsPayload: 중첩 EsmGoodsCreateRequest 빌드 (site별 분리 매핑) + 스키마 통과 (pass).
 *   - 배송 프로필 번호(placeNo/dispatchPolicyNo) 누락 → validation (fail).
 *   - officialNotice 누락 → validation (fail).
 *   - 옥션(site=A) 이미지 중복 → validation (fail, esm.md §4.1).
 *   - createProduct: POST /goods → siteDetail[site].SiteGoodsNo 를 externalId 로 (pass).
 *   - createProduct: SiteGoodsNo 없음 → server 에러 (fail).
 *   - createProduct: 5xx / 401 → MarketError code 매핑 (fail).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { EsmGoodsCreateRequestSchema, type AuthInput, type MarketMapping, type Product } from '@/lib/schemas'
import { buildEsmGoodsPayload } from '../shared-adapter'
import { gmarketRealAdapter } from '../../../real/gmarket'
import { auctionRealAdapter } from '../../../real/auction'
import { MarketError } from '../../../errors'

const PRODUCT: Product = {
  id: '00000000-0000-4000-8000-000000000002',
  sellerId: '00000000-0000-4000-8000-000000000001',
  name: '테스트 상품 A',
  priceKrw: 19_900,
  stock: 50,
  images: [{ url: 'https://cdn.example.com/p/1.jpg', order: 0 }],
  descriptionHtml: '',
  shippingFeeKrw: 0,
}

const OFFICIAL_NOTICE = {
  officialNoticeNo: 'NOTICE-FASHION-01',
  details: [{ code: 'material', value: '면 100%' }],
}

function mappingFor(
  market: 'gmarket' | 'auction',
  extra: Record<string, unknown>,
  urls: string[] = ['https://cdn.example.com/p/1.jpg', 'https://cdn.example.com/p/2.jpg'],
): MarketMapping {
  return {
    market,
    categoryId: '200001234',
    transformedImageUrls: urls,
    extra,
  }
}

const HAPPY_EXTRA = {
  placeNo: 'PLACE-001',
  dispatchPolicyNo: 'DISPATCH-001',
  officialNotice: OFFICIAL_NOTICE,
}

const GMKT_INPUT: AuthInput = {
  kind: 'esm_jwt',
  masterId: 'master_g',
  secretKey: 'SECRET' + 'Z'.repeat(48),
  sellerId: 'gmarket_seller_001',
  site: 'G',
}

describe('buildEsmGoodsPayload — 중첩 페이로드 빌드 (PR-4)', () => {
  it('site=G → siteType 2 / price.Gmkt / dispatchPolicyNo.gmkt / basic+추가 이미지 (pass)', () => {
    const payload = buildEsmGoodsPayload('gmarket', 'G', PRODUCT, mappingFor('gmarket', HAPPY_EXTRA))
    expect(() => EsmGoodsCreateRequestSchema.parse(payload)).not.toThrow()
    expect(payload.itemBasicInfo.category.site[0]?.siteType).toBe(2)
    expect(payload.itemBasicInfo.category.site[0]?.catCode).toBe('200001234')
    expect(payload.itemAddtionalInfo.price).toEqual({ Gmkt: 19_900 })
    expect(payload.itemAddtionalInfo.stock).toEqual({ Gmkt: 50 })
    expect(payload.itemAddtionalInfo.shipping.policy.placeNo).toBe('PLACE-001')
    expect(payload.itemAddtionalInfo.shipping.dispatchPolicyNo).toEqual({ gmkt: 'DISPATCH-001' })
    expect(payload.itemAddtionalInfo.images.basicImgURL).toBe('https://cdn.example.com/p/1.jpg')
    expect(payload.itemAddtionalInfo.images.addtionalImg1URL).toBe('https://cdn.example.com/p/2.jpg')
    expect(payload.itemAddtionalInfo.officialNotice.officialNoticeNo).toBe('NOTICE-FASHION-01')
  })

  it('site=A → siteType 1 / price.Iac / dispatchPolicyNo.iac (pass)', () => {
    const payload = buildEsmGoodsPayload('auction', 'A', PRODUCT, mappingFor('auction', HAPPY_EXTRA))
    expect(payload.itemBasicInfo.category.site[0]?.siteType).toBe(1)
    expect(payload.itemAddtionalInfo.price).toEqual({ Iac: 19_900 })
    expect(payload.itemAddtionalInfo.shipping.dispatchPolicyNo).toEqual({ iac: 'DISPATCH-001' })
  })

  it('상품명 100byte 초과 → truncate (한글 40자 → 33자)', () => {
    const longName = { ...PRODUCT, name: '가'.repeat(40) }
    const payload = buildEsmGoodsPayload('gmarket', 'G', longName, mappingFor('gmarket', HAPPY_EXTRA))
    const bytes = new TextEncoder().encode(payload.itemBasicInfo.goodsName.kor).length
    expect(bytes).toBeLessThanOrEqual(100)
  })

  it('배송 프로필 번호(placeNo/dispatchPolicyNo) 누락 → validation (fail)', () => {
    expect(() =>
      buildEsmGoodsPayload('gmarket', 'G', PRODUCT, mappingFor('gmarket', { officialNotice: OFFICIAL_NOTICE })),
    ).toThrow(MarketError)
  })

  it('officialNotice 누락 → validation (fail)', () => {
    expect(() =>
      buildEsmGoodsPayload('gmarket', 'G', PRODUCT, mappingFor('gmarket', {
        placeNo: 'PLACE-001',
        dispatchPolicyNo: 'DISPATCH-001',
      })),
    ).toThrow(MarketError)
  })

  it('옥션(site=A) 이미지 중복 → validation (fail, esm.md §4.1)', () => {
    const dup = ['https://cdn.example.com/p/1.jpg', 'https://cdn.example.com/p/1.jpg']
    expect(() =>
      buildEsmGoodsPayload('auction', 'A', PRODUCT, mappingFor('auction', HAPPY_EXTRA, dup)),
    ).toThrow(MarketError)
  })
})

describe('createProduct — POST /goods + siteDetail 파싱 (PR-4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetchOnce(status: number, body: unknown): void {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }

  it('siteDetail.gmkt.SiteGoodsNo → externalId + gmarket itemUrl (pass)', async () => {
    await gmarketRealAdapter.authenticate(GMKT_INPUT)
    const payload = gmarketRealAdapter.transformProduct(PRODUCT, mappingFor('gmarket', HAPPY_EXTRA))
    mockFetchOnce(200, {
      goodsNo: 123456,
      siteDetail: { gmkt: { SiteGoodsNo: 'G-998877', SiteGoodsComment: 'Success' } },
      resultCode: 0,
      message: null,
    })
    const result = await gmarketRealAdapter.createProduct(payload)
    expect(result.externalId).toBe('G-998877')
    expect(result.productUrl).toContain('item.gmarket.co.kr')
    expect(result.productUrl).toContain('goodscode=G-998877')
    expect(result.status).toBe('succeeded')
  })

  it('SiteGoodsNo 없음 → server 에러 (fail)', async () => {
    await gmarketRealAdapter.authenticate(GMKT_INPUT)
    const payload = gmarketRealAdapter.transformProduct(PRODUCT, mappingFor('gmarket', HAPPY_EXTRA))
    mockFetchOnce(200, {
      goodsNo: 123456,
      siteDetail: { gmkt: { SiteGoodsComment: '카테고리 오류' } },
      resultCode: 100,
      message: '등록 실패',
    })
    await expect(gmarketRealAdapter.createProduct(payload)).rejects.toMatchObject({
      code: 'server',
    })
  })

  it('5xx → server MarketError (fail)', async () => {
    await gmarketRealAdapter.authenticate(GMKT_INPUT)
    const payload = gmarketRealAdapter.transformProduct(PRODUCT, mappingFor('gmarket', HAPPY_EXTRA))
    mockFetchOnce(500, 'upstream error')
    await expect(gmarketRealAdapter.createProduct(payload)).rejects.toMatchObject({
      code: 'server',
    })
  })

  it('401 → unauthorized MarketError (fail)', async () => {
    await auctionRealAdapter.authenticate({ ...GMKT_INPUT, site: 'A' })
    const payload = auctionRealAdapter.transformProduct(PRODUCT, mappingFor('auction', HAPPY_EXTRA))
    mockFetchOnce(401, 'unauthorized')
    await expect(auctionRealAdapter.createProduct(payload)).rejects.toMatchObject({
      code: 'unauthorized',
    })
  })
})
