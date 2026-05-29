import { describe, it, expect } from 'vitest'
import {
  RegistrationJobStatusSchema,
  MarketResultStatusSchema,
  Step1Schema,
  Step2Schema,
  Step3Schema,
  makeStep3Schema,
  ProductDraftSchema,
  JOB_STATUSES,
  MARKET_RESULT_STATUSES,
} from '@/lib/schemas/registration'

/**
 * 등록 도메인 zod 스키마 단위 테스트.
 *
 * 마스터:
 *  - docs/architecture/v1/cross-cutting/registration-job-state.md §3.1 / §10.1 (ENUM)
 *  - docs/architecture/v1/features/registration.md §9.1 (Step 스키마)
 *  - docs/architecture/v1/testing.md §6.1 (zod 스키마 행복 + 실패)
 *
 * 정책: 각 스키마마다 pass 1건 + fail 최소 1건 (R-001 행복 경로만 금지).
 */

// ─────────────────────────────────────────────
// ENUM
// ─────────────────────────────────────────────
describe('RegistrationJobStatusSchema (7상태 ENUM)', () => {
  it('7개 유효 값 모두 parse 통과', () => {
    for (const status of JOB_STATUSES) {
      expect(RegistrationJobStatusSchema.parse(status)).toBe(status)
    }
  })

  it('정의되지 않은 상태(in_progress) 는 parse 실패', () => {
    // running 이 맞는 값. in_progress 는 흔히 잘못 쓰는 alias → 명시적 거부.
    const res = RegistrationJobStatusSchema.safeParse('in_progress')
    expect(res.success).toBe(false)
  })

  it('빈 문자열 / undefined / null parse 실패', () => {
    expect(RegistrationJobStatusSchema.safeParse('').success).toBe(false)
    expect(RegistrationJobStatusSchema.safeParse(undefined).success).toBe(false)
    expect(RegistrationJobStatusSchema.safeParse(null).success).toBe(false)
  })
})

describe('MarketResultStatusSchema (5상태 ENUM)', () => {
  it('5개 유효 값 모두 parse 통과', () => {
    for (const status of MARKET_RESULT_STATUSES) {
      expect(MarketResultStatusSchema.parse(status)).toBe(status)
    }
  })

  it('상위 잡 상태(succeeded) 는 마켓 결과 상태에서 parse 실패', () => {
    // 두 ENUM 혼동 방지 (registration-job-state.md §3.1 의 분리 강조).
    const res = MarketResultStatusSchema.safeParse('succeeded')
    expect(res.success).toBe(false)
  })
})

// ─────────────────────────────────────────────
// Step1Schema
// ─────────────────────────────────────────────
describe('Step1Schema — 상품 정보 입력 (n16)', () => {
  const valid = {
    name: '테스트 텀블러',
    price: 15_000,
    originalPrice: 18_000,
    brand: 'TestBrand',
    manufacturer: '테스트제조사',
    descriptionHtml: '<p>상품 설명</p>',
    baseCategoryId: 'cat-100',
    shippingPolicyId: '11111111-1111-1111-1111-111111111111',
  }

  it('유효 입력 parse 통과', () => {
    const res = Step1Schema.safeParse(valid)
    expect(res.success).toBe(true)
  })

  it('상품명이 1자면 parse 실패 (min 2)', () => {
    const res = Step1Schema.safeParse({ ...valid, name: '가' })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['name'])
    }
  })

  it('판매가가 0 이면 parse 실패 (min 100)', () => {
    const res = Step1Schema.safeParse({ ...valid, price: 0 })
    expect(res.success).toBe(false)
  })

  it('판매가가 음수면 parse 실패', () => {
    const res = Step1Schema.safeParse({ ...valid, price: -1 })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['price'])
    }
  })

  it('정가 < 판매가 면 refine 실패 (originalPrice 경로)', () => {
    const res = Step1Schema.safeParse({
      ...valid,
      price: 20_000,
      originalPrice: 10_000,
    })
    expect(res.success).toBe(false)
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(['originalPrice'])
    }
  })

  it('shippingPolicyId 가 UUID 가 아니면 parse 실패', () => {
    const res = Step1Schema.safeParse({ ...valid, shippingPolicyId: 'not-a-uuid' })
    expect(res.success).toBe(false)
  })

  it('baseCategoryId 가 빈 문자열이면 parse 실패', () => {
    const res = Step1Schema.safeParse({ ...valid, baseCategoryId: '' })
    expect(res.success).toBe(false)
  })
})

// ─────────────────────────────────────────────
// Step2Schema
// ─────────────────────────────────────────────
describe('Step2Schema — 이미지 (n18)', () => {
  const validImage = {
    id: '11111111-1111-1111-1111-111111111111',
    storagePath: 'sellers/abc/products/img-1.jpg',
    role: 'main' as const,
    sortOrder: 0,
    width: 1024,
    height: 1024,
    bytes: 256_000,
    mimeType: 'image/jpeg' as const,
    hashSha256: 'a'.repeat(64),
  }

  it('이미지 1장(대표) parse 통과', () => {
    const res = Step2Schema.safeParse({ images: [validImage] })
    expect(res.success).toBe(true)
  })

  it('이미지 0장이면 parse 실패 (min 1)', () => {
    const res = Step2Schema.safeParse({ images: [] })
    expect(res.success).toBe(false)
  })

  it('이미지 11장 이상이면 parse 실패 (max 10)', () => {
    const imgs = Array.from({ length: 11 }, (_, i) => ({
      ...validImage,
      id: `11111111-1111-1111-1111-${String(i).padStart(12, '0')}`,
      sortOrder: i % 10,
    }))
    const res = Step2Schema.safeParse({ images: imgs })
    expect(res.success).toBe(false)
  })

  it('대표 이미지 0개면 refine 실패', () => {
    const sub = { ...validImage, role: 'sub' as const }
    const res = Step2Schema.safeParse({ images: [sub] })
    expect(res.success).toBe(false)
  })

  it('대표 이미지 2개면 refine 실패', () => {
    const second = {
      ...validImage,
      id: '22222222-2222-2222-2222-222222222222',
      sortOrder: 1,
    }
    const res = Step2Schema.safeParse({ images: [validImage, second] })
    expect(res.success).toBe(false)
  })

  it('이미지 bytes 가 10MB 초과면 parse 실패', () => {
    const oversize = { ...validImage, bytes: 11 * 1024 * 1024 }
    const res = Step2Schema.safeParse({ images: [oversize] })
    expect(res.success).toBe(false)
  })

  it('지원 외 mimeType(image/gif) parse 실패', () => {
    const gif = { ...validImage, mimeType: 'image/gif' as unknown as 'image/jpeg' }
    const res = Step2Schema.safeParse({ images: [gif] })
    expect(res.success).toBe(false)
  })
})

// ─────────────────────────────────────────────
// Step3Schema
// ─────────────────────────────────────────────
describe('Step3Schema — 마켓 선택 + 카테고리 매핑 (n17 + n19)', () => {
  const sel = {
    marketId: 'naver' as const,
    marketAccountId: '33333333-3333-3333-3333-333333333333',
  }
  const map = {
    marketId: 'naver' as const,
    marketCategoryCode: 'NAVER-CAT-100',
    marketNameOverride: null,
    marketPriceOverride: null,
    marketOptions: {},
  }

  it('마켓 1개 + 매핑 1개 parse 통과', () => {
    const res = Step3Schema.safeParse({ selections: [sel], mappings: [map] })
    expect(res.success).toBe(true)
  })

  it('마켓 0개면 parse 실패', () => {
    const res = Step3Schema.safeParse({ selections: [], mappings: [] })
    expect(res.success).toBe(false)
  })

  it('마켓 6개면 parse 실패 (max 5)', () => {
    const sels = Array.from({ length: 6 }, () => sel)
    const maps = Array.from({ length: 6 }, () => map)
    const res = Step3Schema.safeParse({ selections: sels, mappings: maps })
    expect(res.success).toBe(false)
  })

  it('선택 수와 매핑 수가 불일치하면 refine 실패', () => {
    const res = Step3Schema.safeParse({
      selections: [sel, { ...sel, marketId: 'coupang' as const }],
      mappings: [map],
    })
    expect(res.success).toBe(false)
  })

  it('정의되지 않은 marketId(amazon) parse 실패', () => {
    const res = Step3Schema.safeParse({
      selections: [{ ...sel, marketId: 'amazon' as unknown as 'naver' }],
      mappings: [map],
    })
    expect(res.success).toBe(false)
  })
})

// ─────────────────────────────────────────────
// makeStep3Schema — 마켓별 동적 required 등록필드 (PR-3.5, esm.md §4.6)
// ─────────────────────────────────────────────
describe('makeStep3Schema — 마켓별 required marketOptions', () => {
  const gmarketSel = {
    marketId: 'gmarket' as const,
    marketAccountId: '33333333-3333-3333-3333-333333333333',
  }
  const baseMapping = {
    marketId: 'gmarket' as const,
    marketCategoryCode: 'G-CAT-1',
    marketNameOverride: null,
    marketPriceOverride: null,
  }
  // gmarket 만 shippingProfileId 를 required 로 선언하는 provider.
  const provider = (marketId: string): string[] =>
    marketId === 'gmarket' ? ['shippingProfileId'] : []
  const schema = makeStep3Schema(provider)

  it('required 필드 값이 있으면 통과 (pass)', () => {
    const res = schema.safeParse({
      selections: [gmarketSel],
      mappings: [{ ...baseMapping, marketOptions: { shippingProfileId: 'p1' } }],
    })
    expect(res.success).toBe(true)
  })

  it('required 필드 미입력이면 실패 (fail)', () => {
    const res = schema.safeParse({
      selections: [gmarketSel],
      mappings: [{ ...baseMapping, marketOptions: {} }],
    })
    expect(res.success).toBe(false)
  })

  it('required 필드가 공백 문자열이면 실패 (fail)', () => {
    const res = schema.safeParse({
      selections: [gmarketSel],
      mappings: [{ ...baseMapping, marketOptions: { shippingProfileId: '  ' } }],
    })
    expect(res.success).toBe(false)
  })

  it('provider 가 required 0개인 마켓(naver)은 marketOptions 검증 skip (회귀)', () => {
    const res = schema.safeParse({
      selections: [
        { marketId: 'naver' as const, marketAccountId: gmarketSel.marketAccountId },
      ],
      mappings: [
        {
          marketId: 'naver' as const,
          marketCategoryCode: 'N-CAT-1',
          marketNameOverride: null,
          marketPriceOverride: null,
          marketOptions: {},
        },
      ],
    })
    expect(res.success).toBe(true)
  })

  it('기본 Step3Schema(provider 미주입)는 추가필드 검증을 하지 않는다 (하위호환)', () => {
    const res = Step3Schema.safeParse({
      selections: [gmarketSel],
      mappings: [{ ...baseMapping, marketOptions: {} }],
    })
    expect(res.success).toBe(true)
  })
})

// ─────────────────────────────────────────────
// ProductDraftSchema (전체 종합)
// ─────────────────────────────────────────────
describe('ProductDraftSchema — 전체 위저드 종합', () => {
  const validImage = {
    id: '44444444-4444-4444-4444-444444444444',
    storagePath: 'p.jpg',
    role: 'main' as const,
    sortOrder: 0,
    width: 1024,
    height: 1024,
    bytes: 200_000,
    mimeType: 'image/jpeg' as const,
    hashSha256: 'b'.repeat(64),
  }
  const valid = {
    name: '종합 상품',
    price: 12_000,
    originalPrice: null,
    brand: null,
    manufacturer: null,
    descriptionHtml: null,
    baseCategoryId: 'cat-200',
    shippingPolicyId: '55555555-5555-5555-5555-555555555555',
    images: [validImage],
    selections: [
      {
        marketId: 'naver' as const,
        marketAccountId: '66666666-6666-6666-6666-666666666666',
      },
    ],
    mappings: [
      {
        marketId: 'naver' as const,
        marketCategoryCode: 'C-100',
        marketNameOverride: null,
        marketPriceOverride: null,
        marketOptions: {},
      },
    ],
  }

  it('유효 종합 입력 parse 통과', () => {
    const res = ProductDraftSchema.safeParse(valid)
    expect(res.success).toBe(true)
  })

  it('이미지 0장이면 parse 실패 (Step2 검증 합쳐짐)', () => {
    const res = ProductDraftSchema.safeParse({ ...valid, images: [] })
    expect(res.success).toBe(false)
  })
})
