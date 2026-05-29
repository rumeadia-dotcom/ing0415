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
 *   - transformProduct 변환 규칙 (상품명 80자 / 이미지 MAIN+EXTRA / site 임베드)
 *   - createProduct / fetchCategoryTree HTTP → MarketError 매핑
 *   - 카테고리 응답 파싱 규칙
 *
 * 테스트 카테고리:
 *   E1.  authenticate(esm_jwt, site=G) → kind=esm_jwt, site='G'
 *   E2.  authenticate(잘못된 kind) → 'validation'
 *   E3.  authenticate(site 불일치 A→G) → 'validation'
 *   E4.  transformProduct 상품명 80자 truncate
 *   E5.  transformProduct site 'G' 임베드 + 이미지 MAIN/EXTRA 분기
 *   E6.  HTTP 상태 → MarketError code 매핑 (401/400/429/500)
 *   E7.  카테고리 응답 파싱 — leaf node
 *   E8.  Bearer 헤더 형식 (JWT 발급 → "Bearer <token>")
 */

import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────
// 인라인 재구현 (Edge esm-shared.ts 와 동일)
// ─────────────────────────────────────────────

const PRODUCT_NAME_MAX_LENGTH = 80
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

function transformProduct(
  product: { name: string; priceKrw: number; stock: number; shippingFeeKrw?: number; brand?: string },
  mapping: { categoryId: string; transformedImageUrls: string[]; extra?: Record<string, unknown> },
  site: 'G' | 'A',
  sellerId: string,
) {
  const truncatedName =
    product.name.length > PRODUCT_NAME_MAX_LENGTH
      ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
      : product.name
  return {
    site,
    sellerId,
    itemName: truncatedName,
    sellPrice: product.priceKrw,
    stockQty: product.stock,
    images: mapping.transformedImageUrls.map((url, idx) => ({
      order: idx,
      imageUrl: url,
      imageType: idx === 0 ? 'MAIN' : 'EXTRA',
    })),
    categoryCode: mapping.categoryId,
    shippingFee: product.shippingFeeKrw ?? 0,
    brand: product.brand ?? '',
    ...(mapping.extra ?? {}),
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

describe('E4: transformProduct 상품명 80자 truncate', () => {
  it('100자 상품명 → 80자', () => {
    const product = { name: '가'.repeat(100), priceKrw: 1000, stock: 1 }
    const mapping = { categoryId: 'cat-1', transformedImageUrls: ['https://cdn.example.com/x.jpg'] }
    const result = transformProduct(product, mapping, 'G', SELLER_ID)
    expect(result.itemName).toHaveLength(80)
  })
})

describe('E5: transformProduct site 임베드 + 이미지 MAIN/EXTRA', () => {
  it('site=G 임베드 + images[0]=MAIN, images[1]=EXTRA', () => {
    const product = { name: '상품', priceKrw: 1000, stock: 1 }
    const urls = ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg']
    const mapping = { categoryId: 'cat-1', transformedImageUrls: urls }
    const result = transformProduct(product, mapping, 'G', SELLER_ID)
    expect(result.site).toBe('G')
    expect(result.sellerId).toBe(SELLER_ID)
    expect(result.images[0]?.imageType).toBe('MAIN')
    expect(result.images[1]?.imageType).toBe('EXTRA')
    expect(result.images[0]?.order).toBe(0)
    expect(result.images[1]?.imageUrl).toBe(urls[1])
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
