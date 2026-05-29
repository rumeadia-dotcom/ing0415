/**
 * G마켓 Edge Function 어댑터 단위 테스트 (8건).
 *
 * 파일 위치: tests/unit/market-adapters/gmarket-edge.test.ts
 *
 * 마스터: WIP-5markets-mvp.md C-3 Phase 1 (Edge)
 *
 * Edge Function 어댑터 코드는 Deno 전용 import (npm:zod, .ts extension) 로
 * Vitest 에서 직접 import 불가. 본 테스트는 동일 규칙을 인라인으로 검증한다:
 *   - JWT 발급 시 Bearer 헤더 형식
 *   - authenticate 자격증명 검증 규칙 (esm_jwt + site 일치 강제)
 *   - transformProduct 변환 규칙 (PR-4: 중첩 페이로드 / 상품명 100byte / basic+추가이미지 / siteType)
 *   - createProduct / fetchCategoryTree HTTP → MarketError 매핑
 *   - 카테고리 응답 파싱 규칙
 *
 * 테스트 카테고리:
 *   E1.  authenticate(esm_jwt, site=G) → kind=esm_jwt, site='G'
 *   E2.  authenticate(잘못된 kind) → 'validation'
 *   E3.  authenticate(site 불일치 A→G) → 'validation'
 *   E4.  transformProduct 상품명 100byte truncate (goodsName.kor)
 *   E5.  transformProduct site 'G' → siteType 2 / basic+추가 이미지 / price.Gmkt
 *   E6.  HTTP 상태 → MarketError code 매핑 (401/400/429/500)
 *   E7.  카테고리 응답 파싱 — leaf node
 *   E8.  Bearer 헤더 형식 (JWT 발급 → "Bearer <token>")
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
// 인라인 재구현 (Edge esm-shared.ts 와 동일)
// ─────────────────────────────────────────────

const GOODS_NAME_MAX_BYTES = 100
type MarketErrorCode =
  | 'unauthorized'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'unknown'

function classifyHttpError(status: number): MarketErrorCode {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 400 || status === 422) return 'validation'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'server'
  return 'unknown'
}

function validateEsmCredential(
  input: {
    kind: string
    masterId?: string
    secretKey?: string
    sellerId?: string
    site?: 'G' | 'A'
  },
  adapterSite: 'G' | 'A',
): { valid: boolean; errorCode?: MarketErrorCode; message?: string } {
  if (input.kind !== 'esm_jwt') {
    return {
      valid: false,
      errorCode: 'validation',
      message: `esm_jwt 입력 필요 (received: ${input.kind})`,
    }
  }
  if (!input.masterId) return { valid: false, errorCode: 'validation', message: 'masterId 필수' }
  if (!input.secretKey) return { valid: false, errorCode: 'validation', message: 'secretKey 필수' }
  if (!input.sellerId) return { valid: false, errorCode: 'validation', message: 'sellerId 필수' }
  if (input.site !== adapterSite) {
    return {
      valid: false,
      errorCode: 'validation',
      message: `site 불일치 — 어댑터=${adapterSite}, 입력=${input.site}`,
    }
  }
  return { valid: true }
}

// PR-4: 중첩 EsmGoodsCreateRequest 빌드 규칙 (esm-shared.ts buildEsmGoodsPayload 동형).
// 배송 프로필 번호·officialNotice 는 mapping.extra 로 주입된 값을 사용.
function truncateToBytes(value: string, maxBytes: number): string {
  const enc = new TextEncoder()
  if (enc.encode(value).length <= maxBytes) return value
  let r = value
  while (enc.encode(r).length > maxBytes && r.length > 0) r = r.slice(0, -1)
  return r
}
function transformProduct(
  product: { name: string; priceKrw: number; stock: number },
  mapping: {
    categoryId: string
    transformedImageUrls: string[]
    extra: { placeNo: string; dispatchPolicyNo: string; officialNotice: unknown }
  },
  site: 'G' | 'A',
) {
  const siteType = site === 'G' ? 2 : 1
  const urls = mapping.transformedImageUrls
  const images: Record<string, string> = { basicImgURL: urls[0] ?? '' }
  urls.slice(1, 15).forEach((url, idx) => {
    images[`addtionalImg${idx + 1}URL`] = url
  })
  return {
    itemBasicInfo: {
      goodsName: { kor: truncateToBytes(product.name, GOODS_NAME_MAX_BYTES) },
      category: { site: [{ siteType, catCode: mapping.categoryId }] },
    },
    itemAddtionalInfo: {
      price: site === 'G' ? { Gmkt: product.priceKrw } : { Iac: product.priceKrw },
      stock: site === 'G' ? { Gmkt: product.stock } : { Iac: product.stock },
      sellingPeriod: site === 'G' ? { Gmkt: -1 } : { Iac: -1 },
      shipping: {
        type: 1,
        policy: { placeNo: mapping.extra.placeNo },
        dispatchPolicyNo:
          site === 'G'
            ? { gmkt: mapping.extra.dispatchPolicyNo }
            : { iac: mapping.extra.dispatchPolicyNo },
      },
      images,
      officialNotice: mapping.extra.officialNotice,
      isVatFree: false,
    },
  }
}

interface EsmCategoryRaw {
  categoryId: number | string
  categoryName: string
  isLeaf: boolean
  children?: unknown[]
}
function parseCategoryNode(raw: unknown, depth: number): { id: string; name: string; leaf: boolean } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as EsmCategoryRaw
  if (typeof r.categoryName !== 'string' || typeof r.isLeaf !== 'boolean') return null
  return {
    id: String(r.categoryId),
    name: r.categoryName,
    leaf: r.isLeaf || depth >= 3,
  }
}

// JWT 발급 (esm-jwt 알고리즘 인라인)
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}
function strToBase64Url(s: string): string {
  return bytesToBase64Url(new TextEncoder().encode(s))
}
async function buildJwt(opts: {
  masterId: string
  secretKey: string
  site: 'G' | 'A'
  sellerId?: string
  iat?: number
}): Promise<string> {
  const {
    masterId,
    secretKey,
    site,
    sellerId = 'seller-edge',
    iat = Math.floor(Date.now() / 1000),
  } = opts
  const exp = iat + 300
  const headerB64 = strToBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: masterId }))
  const payloadB64 = strToBase64Url(
    JSON.stringify({
      iss: 'www.esmplus.com',
      sub: 'sell',
      aud: 'sa.esmplus.com',
      iat,
      exp,
      ssi: `${site}:${sellerId}`,
    }),
  )
  const signingInput = `${headerB64}.${payloadB64}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput))
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(sigBuf))}`
}

// ─────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────

const MASTER_ID = 'g-master'
const SECRET_KEY = 'g-secret'
const SELLER_ID = 'g-seller'

// ─────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────

describe('E1: authenticate(esm_jwt, site=G) → 검증 통과', () => {
  it('유효 입력 → valid=true', () => {
    const result = validateEsmCredential(
      { kind: 'esm_jwt', masterId: MASTER_ID, secretKey: SECRET_KEY, sellerId: SELLER_ID, site: 'G' },
      'G',
    )
    expect(result.valid).toBe(true)
  })
})

describe('E2: authenticate(잘못된 kind) → validation', () => {
  it('kind=hmac_key → validation', () => {
    const result = validateEsmCredential(
      { kind: 'hmac_key', masterId: MASTER_ID, secretKey: SECRET_KEY, sellerId: SELLER_ID, site: 'G' },
      'G',
    )
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('validation')
  })
})

describe('E3: authenticate(site 불일치 A→G) → validation', () => {
  it('어댑터 G 인데 입력 site=A → validation', () => {
    const result = validateEsmCredential(
      { kind: 'esm_jwt', masterId: MASTER_ID, secretKey: SECRET_KEY, sellerId: SELLER_ID, site: 'A' },
      'G',
    )
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('validation')
  })
})

const SAMPLE_EXTRA = {
  placeNo: 'PLACE-001',
  dispatchPolicyNo: 'DISPATCH-001',
  officialNotice: {
    officialNoticeNo: 'NOTICE-01',
    details: [{ code: 'material', value: '면 100%' }],
  },
}

describe('E4: transformProduct 상품명 100byte truncate (goodsName.kor)', () => {
  it('한글 40자(120byte) → ≤100byte (33자)', () => {
    const product = { name: '가'.repeat(40), priceKrw: 1000, stock: 1 }
    const mapping = {
      categoryId: 'cat-1',
      transformedImageUrls: ['https://cdn.example.com/x.jpg'],
      extra: SAMPLE_EXTRA,
    }
    const result = transformProduct(product, mapping, 'G')
    const bytes = new TextEncoder().encode(result.itemBasicInfo.goodsName.kor).length
    expect(bytes).toBeLessThanOrEqual(100)
    // 한글 1자 = 3byte → 100/3 = 33자.
    expect(result.itemBasicInfo.goodsName.kor).toHaveLength(33)
  })
})

describe('E5: transformProduct site=G → siteType 2 / basic+추가 이미지 / price.Gmkt', () => {
  it('siteType 2, basicImgURL + addtionalImg1URL, dispatchPolicyNo.gmkt', () => {
    const product = { name: '상품', priceKrw: 1000, stock: 5 }
    const urls = ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']
    const mapping = { categoryId: '200001234', transformedImageUrls: urls, extra: SAMPLE_EXTRA }
    const result = transformProduct(product, mapping, 'G')
    expect(result.itemBasicInfo.category.site[0]?.siteType).toBe(2)
    expect(result.itemBasicInfo.category.site[0]?.catCode).toBe('200001234')
    expect(result.itemAddtionalInfo.price).toEqual({ Gmkt: 1000 })
    expect(result.itemAddtionalInfo.stock).toEqual({ Gmkt: 5 })
    expect(result.itemAddtionalInfo.images.basicImgURL).toBe(urls[0])
    expect(result.itemAddtionalInfo.images.addtionalImg1URL).toBe(urls[1])
    expect(result.itemAddtionalInfo.shipping.policy.placeNo).toBe('PLACE-001')
    expect(result.itemAddtionalInfo.shipping.dispatchPolicyNo).toEqual({
      gmkt: 'DISPATCH-001',
    })
  })
})

describe('E6: HTTP 상태 → MarketError code 매핑', () => {
  it('401/403→unauthorized, 400/422→validation, 429→rate_limit, 5xx→server', () => {
    expect(classifyHttpError(401)).toBe('unauthorized')
    expect(classifyHttpError(403)).toBe('unauthorized')
    expect(classifyHttpError(400)).toBe('validation')
    expect(classifyHttpError(422)).toBe('validation')
    expect(classifyHttpError(429)).toBe('rate_limit')
    expect(classifyHttpError(500)).toBe('server')
    expect(classifyHttpError(503)).toBe('server')
  })
})

describe('E7: 카테고리 응답 파싱', () => {
  it('leaf node → leaf=true', () => {
    const raw = { categoryId: '200001234', categoryName: '여성의류', isLeaf: true }
    const node = parseCategoryNode(raw, 1)
    expect(node).not.toBeNull()
    expect(node?.id).toBe('200001234')
    expect(node?.name).toBe('여성의류')
    expect(node?.leaf).toBe(true)
  })

  it('잘못된 형식 → null', () => {
    const node = parseCategoryNode({ foo: 'bar' }, 1)
    expect(node).toBeNull()
  })
})

describe('E8: JWT 발급 후 Bearer 헤더 형식', () => {
  it('Authorization 헤더 = "Bearer <jwt>"', async () => {
    const token = await buildJwt({
      masterId: MASTER_ID,
      secretKey: SECRET_KEY,
      site: 'G',
      iat: 1747734645,
    })
    const header = `Bearer ${token}`
    expect(header).toMatch(/^Bearer [A-Za-z0-9_\-.]+$/)
    expect(token.split('.')).toHaveLength(3)
  })
})
