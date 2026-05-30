import { describe, it, expect } from 'vitest'
import {
  EsmGoodsCreateRequestSchema,
  EsmGoodsCreateResponseSchema,
  EsmSiteCatSchema,
  EsmOfficialNoticeSchema,
  EsmShippingProfileSchema,
  EsmShippingProfileCreateInputSchema,
  EsmShippingPlaceSchema,
  EsmDispatchPolicySchema,
  EsmShippingListResponseSchema,
  RegistrationFieldMetaSchema,
} from '@/lib/schemas/esm'

/**
 * ESM(G마켓·옥션) zod 스키마 단위 테스트 (PR-0 계약).
 *
 * 마스터:
 *  - docs/architecture/v1/features/esm.md §4
 *  - testing.md R-001 / CLAUDE.md "새 zod 스키마 = pass 1 + fail ≥1"
 */

// ─────────────────────────────────────────────
// 4.4 EsmOfficialNoticeSchema
// ─────────────────────────────────────────────
describe('EsmOfficialNoticeSchema', () => {
  it('officialNoticeNo + details 통과', () => {
    expect(
      EsmOfficialNoticeSchema.safeParse({
        officialNoticeNo: 'WEAR_2025',
        details: [{ code: 'material', value: '면 100%' }],
      }).success,
    ).toBe(true)
  })

  it('officialNoticeNo 빈 문자열이면 실패 (min 1)', () => {
    expect(
      EsmOfficialNoticeSchema.safeParse({
        officialNoticeNo: '',
        details: [],
      }).success,
    ).toBe(false)
  })

  it('details 항목의 value 누락이면 실패', () => {
    expect(
      EsmOfficialNoticeSchema.safeParse({
        officialNoticeNo: 'WEAR_2025',
        details: [{ code: 'material' }],
      }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 4.1 EsmGoodsCreateRequestSchema
// ─────────────────────────────────────────────
describe('EsmGoodsCreateRequestSchema', () => {
  const validGmkt = {
    itemBasicInfo: {
      goodsName: { kor: '여성 봄 가디건' },
      category: { site: [{ siteType: 2 as const, catCode: '300004976' }] },
    },
    itemAddtionalInfo: {
      price: { Gmkt: 29_900 },
      stock: { Gmkt: 100 },
      sellingPeriod: { Gmkt: 30 as const },
      shipping: {
        type: 1 as const,
        policy: { placeNo: 'PLACE-1' },
        dispatchPolicyNo: { gmkt: 'DISPATCH-G-1' },
      },
      images: {
        basicImgURL: 'https://cdn.example.com/img/main.jpg',
        addtionalImg1URL: 'https://cdn.example.com/img/extra1.jpg',
      },
      officialNotice: {
        officialNoticeNo: 'WEAR_2025',
        details: [{ code: 'material', value: '면 100%' }],
      },
      isVatFree: false,
    },
  }

  it('지마켓(siteType:2) 유효 페이로드 통과', () => {
    expect(EsmGoodsCreateRequestSchema.safeParse(validGmkt).success).toBe(true)
  })

  it('옥션(siteType:1) 유효 페이로드 통과 (Iac 채움)', () => {
    const validAuction = {
      ...validGmkt,
      itemBasicInfo: {
        ...validGmkt.itemBasicInfo,
        category: { site: [{ siteType: 1 as const, catCode: '300004976' }] },
      },
      itemAddtionalInfo: {
        ...validGmkt.itemAddtionalInfo,
        price: { Iac: 29_900 },
        stock: { Iac: 100 },
        sellingPeriod: { Iac: 30 as const },
        shipping: {
          type: 1 as const,
          policy: { placeNo: 'PLACE-1' },
          dispatchPolicyNo: { iac: 'DISPATCH-A-1' },
        },
      },
    }
    expect(EsmGoodsCreateRequestSchema.safeParse(validAuction).success).toBe(
      true,
    )
  })

  it('상품명(kor) 100byte 초과면 실패 (한글 34자 = 102byte)', () => {
    const res = EsmGoodsCreateRequestSchema.safeParse({
      ...validGmkt,
      itemBasicInfo: {
        ...validGmkt.itemBasicInfo,
        goodsName: { kor: '가'.repeat(34) },
      },
    })
    expect(res.success).toBe(false)
  })

  // byte 경계 정밀 — 한글(3byte)로는 99↔102 만 짚어 100/101 경계를 건너뛴다.
  // ASCII 1byte 로 정확히 100byte(통과) / 101byte(실패) 를 찌른다 (esm.md §4.1 ≤100byte).
  it('상품명(kor) 정확히 100byte(ASCII)면 통과', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemBasicInfo: {
          ...validGmkt.itemBasicInfo,
          goodsName: { kor: 'a'.repeat(100) },
        },
      }).success,
    ).toBe(true)
  })

  it('상품명(kor) 정확히 101byte(ASCII)면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemBasicInfo: {
          ...validGmkt.itemBasicInfo,
          goodsName: { kor: 'a'.repeat(101) },
        },
      }).success,
    ).toBe(false)
  })

  it('가격이 10원 단위가 아니면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: { ...validGmkt.itemAddtionalInfo, price: { Gmkt: 29_905 } },
      }).success,
    ).toBe(false)
  })

  // 가격 하한 — 10원 미만(esm.md §4.1: 10 ≤ p < 1e9). 0 은 하한 위반.
  it('가격 하한(10원 미만)이면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: { ...validGmkt.itemAddtionalInfo, price: { Gmkt: 0 } },
      }).success,
    ).toBe(false)
  })

  // 가격 상한 — 1e9 이상(esm.md §4.1: p < 1e9). max(999_999_999) 초과.
  it('가격 상한(1e9 이상)이면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: {
          ...validGmkt.itemAddtionalInfo,
          price: { Gmkt: 1_000_000_010 },
        },
      }).success,
    ).toBe(false)
  })

  it('재고 99999 초과면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: { ...validGmkt.itemAddtionalInfo, stock: { Gmkt: 100_000 } },
      }).success,
    ).toBe(false)
  })

  // 재고 하한 — 0(esm.md §4.1: 1~99999). min(1) 위반.
  it('재고 0(하한 미만)이면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: { ...validGmkt.itemAddtionalInfo, stock: { Gmkt: 0 } },
      }).success,
    ).toBe(false)
  })

  it('sellingPeriod enum 외 값이면 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: {
          ...validGmkt.itemAddtionalInfo,
          sellingPeriod: { Gmkt: 45 },
        },
      }).success,
    ).toBe(false)
  })

  it('지마켓 등록인데 price.Gmkt 누락이면 superRefine 실패', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: { ...validGmkt.itemAddtionalInfo, price: { Iac: 29_900 } },
      }).success,
    ).toBe(false)
  })

  it('옥션 이미지 URL 중복이면 실패', () => {
    const dup = 'https://cdn.example.com/img/dup.jpg'
    const res = EsmGoodsCreateRequestSchema.safeParse({
      itemBasicInfo: {
        goodsName: { kor: '옥션 상품' },
        category: { site: [{ siteType: 1 as const, catCode: '300004976' }] },
      },
      itemAddtionalInfo: {
        price: { Iac: 10_000 },
        stock: { Iac: 5 },
        sellingPeriod: { Iac: -1 as const },
        shipping: {
          type: 1 as const,
          policy: { placeNo: 'PLACE-1' },
          dispatchPolicyNo: { iac: 'DISPATCH-A-1' },
        },
        images: { basicImgURL: dup, addtionalImg1URL: dup },
        officialNotice: {
          officialNoticeNo: 'WEAR_2025',
          details: [{ code: 'material', value: '면 100%' }],
        },
        isVatFree: false,
      },
    })
    expect(res.success).toBe(false)
  })

  it('이미지에 알 수 없는 키가 있으면 실패 (strict)', () => {
    expect(
      EsmGoodsCreateRequestSchema.safeParse({
        ...validGmkt,
        itemAddtionalInfo: {
          ...validGmkt.itemAddtionalInfo,
          images: {
            ...validGmkt.itemAddtionalInfo.images,
            addtionalImg15URL: 'https://cdn.example.com/img/over.jpg',
          },
        },
      }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 4.2 EsmGoodsCreateResponseSchema
// ─────────────────────────────────────────────
describe('EsmGoodsCreateResponseSchema', () => {
  it('지마켓 siteDetail 응답 통과 + passthrough 미지 필드 보존', () => {
    const res = EsmGoodsCreateResponseSchema.safeParse({
      goodsNo: 1234567,
      siteDetail: {
        gmkt: { SiteGoodsNo: 'G-9999', SiteGoodsComment: 'Success' },
      },
      resultCode: 0,
      message: null,
      unknownField: 'preserved',
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.siteDetail?.gmkt?.SiteGoodsNo).toBe('G-9999')
      expect((res.data as Record<string, unknown>).unknownField).toBe(
        'preserved',
      )
    }
  })

  it('goodsNo 가 number 가 아니면 실패', () => {
    expect(
      EsmGoodsCreateResponseSchema.safeParse({
        goodsNo: 'not-a-number',
        resultCode: 0,
      }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 4.3 EsmSiteCatSchema
// ─────────────────────────────────────────────
describe('EsmSiteCatSchema', () => {
  it('재귀 children 트리 통과', () => {
    expect(
      EsmSiteCatSchema.safeParse({
        siteCatCode: '300004975',
        siteCatName: '패션의류',
        isLeaf: false,
        siteType: 2,
        children: [
          {
            siteCatCode: '300004976',
            siteCatName: '여성의류',
            isLeaf: true,
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('isLeaf 누락이면 실패', () => {
    expect(
      EsmSiteCatSchema.safeParse({
        siteCatCode: '300004975',
        siteCatName: '패션의류',
      }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 4.5 EsmShippingProfileSchema / CreateInput
// ─────────────────────────────────────────────
describe('EsmShippingProfileSchema', () => {
  const valid = {
    id: '11111111-1111-1111-1111-111111111111',
    sellerId: '22222222-2222-2222-2222-222222222222',
    marketAccountId: '33333333-3333-3333-3333-333333333333',
    site: 'G' as const,
    profileLabel: '기본 출고지/택배',
    addrNo: 'ADDR-1',
    placeNo: 'PLACE-1',
    bundlePolicyNo: 'BUNDLE-1',
    dispatchPolicyNo: 'DISPATCH-G-1',
    dispatchType: 'A' as const,
    shippingFee: 3000,
    feeType: 1 as const,
    status: 'active' as const,
    createdAt: '2026-05-30T03:00:00+09:00',
    updatedAt: '2026-05-30T03:00:00+09:00',
  }

  it('유효 저장형 프로필 통과 (bundlePolicyNo 생략 가능)', () => {
    const { bundlePolicyNo: _omit, ...rest } = valid
    void _omit
    expect(EsmShippingProfileSchema.safeParse(rest).success).toBe(true)
  })

  it('dispatchType 가 enum 외면 실패', () => {
    expect(
      EsmShippingProfileSchema.safeParse({ ...valid, dispatchType: 'Z' })
        .success,
    ).toBe(false)
  })

  it('feeType 가 1/2 외면 실패', () => {
    expect(
      EsmShippingProfileSchema.safeParse({ ...valid, feeType: 3 }).success,
    ).toBe(false)
  })
})

describe('EsmShippingProfileCreateInputSchema', () => {
  const validInput = {
    marketAccountId: '33333333-3333-3333-3333-333333333333',
    site: 'A' as const,
    profileLabel: '옥션 기본',
    dispatchType: 'B' as const,
    shippingFee: 0,
    feeType: 2 as const,
    address: {
      zipCode: '06236',
      addressMain: '서울 강남구 테헤란로 1',
      addressDetail: '5F',
      contactName: '홍길동',
      contactPhone: '010-1234-5678',
    },
  }

  it('유효 생성 입력 통과', () => {
    expect(
      EsmShippingProfileCreateInputSchema.safeParse(validInput).success,
    ).toBe(true)
  })

  it('address.contactName 누락이면 실패', () => {
    const { address, ...rest } = validInput
    const { contactName: _omit, ...addrRest } = address
    void _omit
    expect(
      EsmShippingProfileCreateInputSchema.safeParse({
        ...rest,
        address: addrRest,
      }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 4.6 RegistrationFieldMetaSchema
// ─────────────────────────────────────────────
describe('RegistrationFieldMetaSchema', () => {
  it('shippingProfile 필드 메타 통과', () => {
    expect(
      RegistrationFieldMetaSchema.safeParse({
        key: 'shippingProfileId',
        label: 'registration.fields.shippingProfile',
        kind: 'shippingProfile',
        required: true,
        optionsSource: 'shippingProfiles',
        blockingReason: '배송 프로필을 선택해주세요',
      }).success,
    ).toBe(true)
  })

  it('officialNotice 필드 메타 통과 (optional 필드 생략)', () => {
    expect(
      RegistrationFieldMetaSchema.safeParse({
        key: 'officialNotice',
        label: 'registration.fields.officialNotice',
        kind: 'officialNotice',
        required: true,
      }).success,
    ).toBe(true)
  })

  it('kind 가 enum 외면 실패', () => {
    expect(
      RegistrationFieldMetaSchema.safeParse({
        key: 'x',
        label: 'x',
        kind: 'checkbox',
        required: false,
      }).success,
    ).toBe(false)
  })
})

// ─────────────────────────────────────────────
// 4.7 조회형 배송 리소스 (PR-E1 — 생성형→조회형 전환)
//   esm.md "전환 결정 2026-05-30" / esm-api/product/17.md / 19.md
// ─────────────────────────────────────────────

describe('EsmShippingPlaceSchema (출하지 조회 정규화)', () => {
  it('placeNo + placeName + isDefault 통과', () => {
    expect(
      EsmShippingPlaceSchema.safeParse({
        placeNo: '177067',
        placeName: '테스트001',
        isDefault: false,
      }).success,
    ).toBe(true)
  })

  it('placeName 빈 문자열이면 실패 (min 1)', () => {
    expect(
      EsmShippingPlaceSchema.safeParse({
        placeNo: '177067',
        placeName: '',
        isDefault: false,
      }).success,
    ).toBe(false)
  })

  it('placeNo 누락이면 실패', () => {
    expect(
      EsmShippingPlaceSchema.safeParse({
        placeName: '테스트001',
        isDefault: true,
      }).success,
    ).toBe(false)
  })
})

describe('EsmDispatchPolicySchema (발송정책 조회 정규화)', () => {
  it('site + 번호 + 이름 + dispatchType 통과', () => {
    expect(
      EsmDispatchPolicySchema.safeParse({
        site: 'G',
        dispatchPolicyNo: '910',
        dispatchPolicyName: '당일발송',
        dispatchType: 'A',
        isDefault: true,
      }).success,
    ).toBe(true)
  })

  it('dispatchType 이 enum(A~F) 외면 실패', () => {
    expect(
      EsmDispatchPolicySchema.safeParse({
        site: 'A',
        dispatchPolicyNo: '910',
        dispatchPolicyName: '당일발송',
        dispatchType: 'Z',
        isDefault: false,
      }).success,
    ).toBe(false)
  })

  it('site 가 G/A 외면 실패', () => {
    expect(
      EsmDispatchPolicySchema.safeParse({
        site: 'X',
        dispatchPolicyNo: '910',
        dispatchPolicyName: '당일발송',
        dispatchType: 'A',
        isDefault: false,
      }).success,
    ).toBe(false)
  })
})

describe('EsmShippingListResponseSchema (조회 Edge 200 응답)', () => {
  it('빈 목록도 통과 (셀러가 ESM Plus 에 설정 없음)', () => {
    expect(
      EsmShippingListResponseSchema.safeParse({
        site: 'G',
        places: [],
        dispatchPolicies: [],
      }).success,
    ).toBe(true)
  })

  it('places + dispatchPolicies 채워진 응답 통과', () => {
    expect(
      EsmShippingListResponseSchema.safeParse({
        site: 'A',
        places: [{ placeNo: '1', placeName: '기본출하지', isDefault: true }],
        dispatchPolicies: [
          {
            site: 'A',
            dispatchPolicyNo: '910',
            dispatchPolicyName: '당일발송',
            dispatchType: 'A',
            isDefault: true,
          },
        ],
      }).success,
    ).toBe(true)
  })

  it('places 항목 형식 오류면 실패', () => {
    expect(
      EsmShippingListResponseSchema.safeParse({
        site: 'G',
        places: [{ placeNo: '1' }], // placeName/isDefault 누락
        dispatchPolicies: [],
      }).success,
    ).toBe(false)
  })
})
