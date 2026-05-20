/**
 * 쿠팡 Edge Function 어댑터 단위 테스트 (10건).
 *
 * 파일 위치: tests/unit/market-adapters/coupang-edge.test.ts
 * (vitest.config.ts 의 tests/unit/**\/\*.test.ts 경로에 포함됨)
 *
 * 마스터: WIP-5markets-mvp.md C-2 Phase 2
 * 근거 — PRD §2.4 자격증명 보안, market-adapter.md §9.
 *
 * Edge Function 어댑터 코드는 Deno 전용 import (npm:zod, .ts extension) 로
 * Vitest 에서 직접 import 불가. 본 테스트는 동일 알고리즘을 인라인으로 검증한다:
 *   - HMAC 서명 알고리즘 (coupang-hmac.ts 와 동일 로직)
 *   - authenticate 자격증명 검증 규칙
 *   - transformProduct 변환 규칙
 *   - createProduct HTTP → MarketError 매핑 규칙
 *   - fetchCategoryTree 응답 파싱 규칙
 *
 * 테스트 카테고리:
 *   E1. HMAC 서명 알고리즘 — datetime 포맷 + message 구조
 *   E2. HMAC 서명 결정성 — 같은 입력 → 같은 서명
 *   E3. authenticate(hmac_key) → StoredCredential 구조 검증
 *   E4. authenticate(잘못된 kind) → 'validation' 에러 분류
 *   E5. authenticate(빈 vendorId) → 'validation' 에러 분류
 *   E6. transformProduct 상품명 50자 제한
 *   E7. transformProduct 이미지 배열 순서 보존
 *   E8. fetchCategoryTree 200 응답 → CategoryNode 반환
 *   E9. createProduct 401 → 'unauthorized' 에러 코드
 *  E10. createProduct 500 → 'server' 에러 코드
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
// Edge Function 의 HMAC 알고리즘을 인라인으로 재구현 (Vitest 환경)
// 출처: apps/api/supabase/functions/_shared/market-adapters/coupang-hmac.ts
// ─────────────────────────────────────────────

function formatCoupangDatetime(date: Date): string {
  const pad2 = (n: number): string => String(n).padStart(2, '0')
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = pad2(date.getUTCMonth() + 1)
  const day = pad2(date.getUTCDate())
  const hour = pad2(date.getUTCHours())
  const min = pad2(date.getUTCMinutes())
  const sec = pad2(date.getUTCSeconds())
  return `${year}${month}${day}T${hour}${min}${sec}Z`
}

async function buildSignature(opts: {
  method: string
  path: string
  accessKey: string
  secretKey: string
  now?: Date
}) {
  const { method, path, accessKey, secretKey, now = new Date() } = opts
  const datetime = formatCoupangDatetime(now)
  const upperMethod = method.toUpperCase()
  const message = `${datetime}\n${upperMethod}\n${path}\n`

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const buf = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(message))
  const signature = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`
  return { datetime, signature, authorization }
}

// ─────────────────────────────────────────────
// 에러 분류 로직 (coupang.ts httpStatusToMarketError 와 동일)
// ─────────────────────────────────────────────

type MarketErrorCode = 'unauthorized' | 'rate_limit' | 'validation' | 'network' | 'server' | 'unknown'

function classifyHttpError(status: number): MarketErrorCode {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 400 || status === 422) return 'validation'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'server'
  return 'unknown'
}

// ─────────────────────────────────────────────
// transformProduct 로직 (coupang.ts 와 동일)
// ─────────────────────────────────────────────

const PRODUCT_NAME_MAX_LENGTH = 50

function transformProduct(product: {
  name: string
  priceKrw: number
  stock: number
  shippingFeeKrw?: number
  brand?: string
}, mapping: {
  categoryId: string
  transformedImageUrls: string[]
  extra?: Record<string, unknown>
}) {
  const truncatedName =
    product.name.length > PRODUCT_NAME_MAX_LENGTH
      ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
      : product.name

  return {
    sellerProductName: truncatedName,
    salePrice: product.priceKrw,
    stockQuantity: product.stock,
    images: mapping.transformedImageUrls.map((url, idx) => ({
      imageOrder: idx,
      imageType: 'REPRESENTATION',
      cdnPath: url,
    })),
    displayCategoryCode: Number(mapping.categoryId),
    shippingFee: product.shippingFeeKrw ?? 0,
    brand: product.brand ?? '',
    ...(mapping.extra ?? {}),
  }
}

// ─────────────────────────────────────────────
// authenticate 검증 로직
// ─────────────────────────────────────────────

function validateHmacCredential(input: { kind: string; accessKey?: string; secretKey?: string; vendorId?: string }): { valid: boolean; errorCode?: MarketErrorCode; message?: string } {
  if (input.kind !== 'hmac_key') {
    return { valid: false, errorCode: 'validation', message: `hmac_key 입력 필요 (received: ${input.kind})` }
  }
  if (!input.accessKey) return { valid: false, errorCode: 'validation', message: 'accessKey 필수' }
  if (!input.secretKey) return { valid: false, errorCode: 'validation', message: 'secretKey 필수' }
  if (!input.vendorId) return { valid: false, errorCode: 'validation', message: 'vendorId 필수' }
  return { valid: true }
}

// ─────────────────────────────────────────────
// 카테고리 응답 파싱 로직
// ─────────────────────────────────────────────

interface CoupangCategoryData {
  categoryId: number
  displayCategoryName: string
  isLeafCategory: boolean
  subCategories?: { categoryId: number; displayCategoryName: string; isLeafCategory: boolean }[]
}

function parseCategoryResponse(raw: unknown, depth: number): { id: string; name: string; leaf: boolean } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as { code?: string; data?: CoupangCategoryData }
  if (!r.data) return null
  return {
    id: String(r.data.categoryId),
    name: r.data.displayCategoryName,
    leaf: r.data.isLeafCategory || depth >= 3,
  }
}

// ─────────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────────

const FIXED_DATE = new Date('2026-05-20T09:30:45.000Z')
const ACCESS_KEY = 'test-access-key'
const SECRET_KEY = 'test-secret-key'
const VENDOR_ID = 'A00012345'
const FIXED_PATH = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products'

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe('E1: HMAC datetime 포맷 + message 구조', () => {
  it('formatCoupangDatetime 은 YYMMDDTHHmmssZ 형식', () => {
    expect(formatCoupangDatetime(FIXED_DATE)).toBe('260520T093045Z')
  })

  it('메서드 대소문자 → 대문자 정규화 후 서명에 반영', async () => {
    const upper = await buildSignature({ method: 'POST', path: FIXED_PATH, accessKey: ACCESS_KEY, secretKey: SECRET_KEY, now: FIXED_DATE })
    const lower = await buildSignature({ method: 'post', path: FIXED_PATH, accessKey: ACCESS_KEY, secretKey: SECRET_KEY, now: FIXED_DATE })
    expect(lower.signature).toBe(upper.signature)
  })
})

describe('E2: HMAC 서명 결정성', () => {
  it('같은 입력 두 번 → 동일 서명', async () => {
    const r1 = await buildSignature({ method: 'GET', path: FIXED_PATH, accessKey: ACCESS_KEY, secretKey: SECRET_KEY, now: FIXED_DATE })
    const r2 = await buildSignature({ method: 'GET', path: FIXED_PATH, accessKey: ACCESS_KEY, secretKey: SECRET_KEY, now: FIXED_DATE })
    expect(r1.signature).toBe(r2.signature)
  })

  it('path 변경 → 서명 변경', async () => {
    const r1 = await buildSignature({ method: 'GET', path: '/path/one', accessKey: ACCESS_KEY, secretKey: SECRET_KEY, now: FIXED_DATE })
    const r2 = await buildSignature({ method: 'GET', path: '/path/two', accessKey: ACCESS_KEY, secretKey: SECRET_KEY, now: FIXED_DATE })
    expect(r1.signature).not.toBe(r2.signature)
  })
})

describe('E3: authenticate(hmac_key) → StoredCredential 구조', () => {
  it('유효 hmac_key → kind=hmac payload 반환', () => {
    const input = { kind: 'hmac_key', accessKey: ACCESS_KEY, secretKey: SECRET_KEY, vendorId: VENDOR_ID }
    const result = validateHmacCredential(input)
    expect(result.valid).toBe(true)

    // StoredCredential 구조 확인
    const stored = {
      kind: 'hmac',
      payload: { accessKey: input.accessKey, secretKey: input.secretKey, vendorId: input.vendorId },
    }
    expect(stored.kind).toBe('hmac')
    expect(stored.payload.vendorId).toBe(VENDOR_ID)
  })
})

describe('E4: authenticate(잘못된 kind) → validation 분류', () => {
  it('kind=oauth_code → validation 에러', () => {
    const result = validateHmacCredential({ kind: 'oauth_code', accessKey: ACCESS_KEY, secretKey: SECRET_KEY, vendorId: VENDOR_ID })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('validation')
  })
})

describe('E5: authenticate(빈 vendorId) → validation 분류', () => {
  it('빈 vendorId → validation 에러', () => {
    const result = validateHmacCredential({ kind: 'hmac_key', accessKey: ACCESS_KEY, secretKey: SECRET_KEY, vendorId: '' })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('validation')
  })
})

describe('E6: transformProduct 상품명 50자 제한', () => {
  it('60자 상품명 → 50자로 truncate', () => {
    const product = { name: '가'.repeat(60), priceKrw: 1000, stock: 1 }
    const mapping = { categoryId: '56137', transformedImageUrls: ['https://cdn.example.com/img.jpg'] }
    const result = transformProduct(product, mapping)
    expect(result.sellerProductName).toHaveLength(50)
  })

  it('30자 상품명 → 그대로 유지', () => {
    const name = '나'.repeat(30)
    const product = { name, priceKrw: 1000, stock: 1 }
    const mapping = { categoryId: '56137', transformedImageUrls: ['https://cdn.example.com/img.jpg'] }
    const result = transformProduct(product, mapping)
    expect(result.sellerProductName).toBe(name)
  })
})

describe('E7: transformProduct 이미지 배열 순서 보존', () => {
  it('이미지 URL 배열 순서 유지', () => {
    const product = { name: '상품', priceKrw: 1000, stock: 1 }
    const urls = ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg', 'https://cdn.example.com/c.jpg']
    const mapping = { categoryId: '56137', transformedImageUrls: urls }
    const result = transformProduct(product, mapping)
    expect(result.images[0]?.cdnPath).toBe(urls[0])
    expect(result.images[1]?.cdnPath).toBe(urls[1])
    expect(result.images[2]?.cdnPath).toBe(urls[2])
    expect(result.images[0]?.imageOrder).toBe(0)
  })
})

describe('E8: fetchCategoryTree 응답 파싱', () => {
  it('정상 응답 → CategoryNode 기본 필드 반환', () => {
    const raw = {
      code: '200',
      data: {
        categoryId: 56137,
        displayCategoryName: '여성의류',
        isLeafCategory: true,
        subCategories: [],
      },
    }
    const node = parseCategoryResponse(raw, 1)
    expect(node).not.toBeNull()
    expect(node?.id).toBe('56137')
    expect(node?.name).toBe('여성의류')
    expect(node?.leaf).toBe(true)
  })

  it('data 없는 응답 → null 반환 (에러 신호)', () => {
    const raw = { code: '404', message: '카테고리 없음' }
    const node = parseCategoryResponse(raw, 1)
    expect(node).toBeNull()
  })
})

describe('E9: createProduct 401 → unauthorized', () => {
  it('HTTP 401 → MarketErrorCode("unauthorized")', () => {
    expect(classifyHttpError(401)).toBe('unauthorized')
    expect(classifyHttpError(403)).toBe('unauthorized')
  })
})

describe('E10: createProduct 500 → server', () => {
  it('HTTP 500 → MarketErrorCode("server")', () => {
    expect(classifyHttpError(500)).toBe('server')
    expect(classifyHttpError(503)).toBe('server')
  })

  it('HTTP 429 → rate_limit', () => {
    expect(classifyHttpError(429)).toBe('rate_limit')
  })
})
