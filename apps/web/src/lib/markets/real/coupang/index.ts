/**
 * 쿠팡 Wing OpenAPI real 어댑터 (프론트엔드 / Vite 환경).
 *
 * 마스터:
 *   - docs/architecture/v1/cross-cutting/market-adapter.md §9
 *   - WIP-5markets-mvp.md C-2 Phase 1
 *
 * 인증 방식: HMAC-SHA256 (credential kind = 'hmac').
 *   - refreshToken 없음 (영구 키).
 *   - authenticate = 자격증명 검증 후 StoredCredential 저장 (API 호출 없이).
 *
 * API 기반:
 *   - COUPANG_API_BASE = https://api-gateway.coupang.com
 *   - 카테고리: GET /v2/providers/seller_api/apis/api/v1/categorization/display-categories/{categoryId}
 *   - 상품 생성: POST /v2/providers/seller_api/apis/api/v1/marketplace/seller-products
 *
 * 중요 제약:
 *   - accessKey / secretKey / vendorId 는 절대 로그에 포함 금지.
 *   - 모든 외부 호출에 correlationId 부여.
 *   - 상품명 최대 50자 (Wing OpenAPI 요건), 초과 시 truncate.
 *   - 카테고리 트리는 depth 3 까지 재귀 fetch (timeout 10s).
 *
 * 현재 제약 (베타):
 *   - 실제 자격증명 미보유. 통합 테스트는 fetch mock 으로.
 *   - 상품 등록 API 최종 payload 스펙 베타 셀러 확인 후 보정 예정.
 */

import { z } from 'zod'
import { MarketError } from '../../errors'
import type { MarketAdapter } from '../../types'
import {
  HmacKeyAuthInputSchema,
  StoredCredentialSchema,
  CategoryNodeSchema,
  CreateProductResultSchema,
  type AuthInput,
  type CategoryNode,
  type CreateProductResult,
  type MarketMapping,
  type MarketPayload,
  type Product,
  type StoredCredential,
} from '@/lib/schemas'
import { buildCoupangSignature } from './hmac'

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

export const COUPANG_API_BASE = 'https://api-gateway.coupang.com'
const MARKET = 'coupang' as const
const CATEGORY_TIMEOUT_MS = 10_000
const PRODUCT_NAME_MAX_LENGTH = 50

// ─────────────────────────────────────────────
// Wing OpenAPI 응답 zod 스키마 (런타임 검증)
// ─────────────────────────────────────────────

const CoupangCategoryResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  data: z
    .object({
      categoryId: z.number(),
      displayCategoryName: z.string(),
      isLeafCategory: z.boolean(),
      subCategories: z
        .array(
          z.object({
            categoryId: z.number(),
            displayCategoryName: z.string(),
            isLeafCategory: z.boolean(),
          }),
        )
        .optional()
        .default([]),
    })
    .optional(),
})

const CoupangCreateProductResponseSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  data: z
    .object({
      sellerProductId: z.number().optional(),
      productUrl: z.string().url().optional(),
    })
    .optional(),
})

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

/**
 * 쿠팡 Wing OpenAPI fetch wrapper.
 * - HMAC Authorization 헤더 자동 부여.
 * - timeout abort.
 * - HTTP 에러 → MarketError 변환.
 */
async function coupangFetch(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  accessKey: string
  secretKey: string
  body?: unknown
  correlationId: string
  timeoutMs?: number
}): Promise<Response> {
  const { method, path, accessKey, secretKey, body, correlationId, timeoutMs = 15_000 } =
    opts

  const { authorization } = await buildCoupangSignature({
    method,
    path,
    accessKey,
    secretKey,
  })

  const controller = new AbortController()
  const timerId = setTimeout(() => { controller.abort() }, timeoutMs)

  try {
    const response = await fetch(`${COUPANG_API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authorization,
        'X-Correlation-Id': correlationId,
      },
      body: body !== undefined ? JSON.stringify(body) : null,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketError('network', '쿠팡 API 요청 timeout', {
        market: MARKET,
        cause: err,
        marketErrorCode: 'timeout',
      })
    }
    throw new MarketError('network', '쿠팡 API 네트워크 오류', {
      market: MARKET,
      cause: err,
    })
  } finally {
    clearTimeout(timerId)
  }
}

/**
 * HTTP 상태 → MarketError code 매핑.
 */
function httpStatusToMarketError(
  status: number,
  message: string,
  correlationId: string,
): MarketError {
  if (status === 401 || status === 403) {
    return new MarketError('unauthorized', `쿠팡 인증 실패 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 400 || status === 422) {
    return new MarketError('validation', `쿠팡 요청 검증 실패 (${status}): ${message}`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  if (status === 429) {
    return new MarketError('rate_limit', '쿠팡 API rate limit 초과', {
      market: MARKET,
      status,
      retryAfterMs: 5_000,
      marketErrorCode: 'rate_limit',
    })
  }
  if (status >= 500) {
    return new MarketError('server', `쿠팡 서버 오류 (${status})`, {
      market: MARKET,
      status,
      marketErrorMessage: message,
      marketErrorCode: String(status),
    })
  }
  return new MarketError('unknown', `쿠팡 API 오류 (${status}) correlationId=${correlationId}`, {
    market: MARKET,
    status,
    marketErrorMessage: message,
  })
}

/**
 * 카테고리 단건 fetch + 하위 3depth 재귀.
 */
async function fetchCategoryNode(
  categoryId: number,
  depth: number,
  accessKey: string,
  secretKey: string,
  correlationId: string,
): Promise<CategoryNode> {
  const path = `/v2/providers/seller_api/apis/api/v1/categorization/display-categories/${categoryId}`
  const response = await coupangFetch({
    method: 'GET',
    path,
    accessKey,
    secretKey,
    correlationId,
    timeoutMs: CATEGORY_TIMEOUT_MS,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw httpStatusToMarketError(response.status, text, correlationId)
  }

  const raw = await response.json()
  const parsed = CoupangCategoryResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new MarketError('server', '쿠팡 카테고리 응답 파싱 실패', {
      market: MARKET,
      cause: parsed.error,
    })
  }

  const data = parsed.data.data
  if (!data) {
    throw new MarketError('server', '쿠팡 카테고리 데이터 없음', {
      market: MARKET,
      marketErrorCode: parsed.data.code,
      ...(parsed.data.message !== undefined ? { marketErrorMessage: parsed.data.message } : {}),
    })
  }

  const isLeaf = data.isLeafCategory || depth >= 3
  const children: CategoryNode[] = []

  // depth 3 미만이고 하위 카테고리가 있으면 재귀 fetch
  if (!isLeaf && data.subCategories && data.subCategories.length > 0) {
    for (const sub of data.subCategories) {
      const child = await fetchCategoryNode(
        sub.categoryId,
        depth + 1,
        accessKey,
        secretKey,
        correlationId,
      )
      children.push(child)
    }
  }

  const node: CategoryNode = {
    id: String(data.categoryId),
    name: data.displayCategoryName,
    depth,
    leaf: isLeaf,
    parentId: depth === 1 ? null : String(categoryId),
    children,
  }

  return CategoryNodeSchema.parse(node)
}

// ─────────────────────────────────────────────
// 어댑터 구현
// ─────────────────────────────────────────────

/**
 * HMAC 자격증명 — StoredCredential.payload (runtime).
 * 어댑터 인스턴스에 저장, 외부 노출 금지.
 */
interface HmacCred {
  accessKey: string
  secretKey: string
  vendorId: string
}

function createCoupangRealAdapter(): MarketAdapter {
  // 인스턴스 자격증명 (authenticate 후 설정)
  let cred: HmacCred | null = null

  function getCredOrThrow(): HmacCred {
    if (!cred) {
      throw new MarketError('unauthorized', '쿠팡 어댑터: authenticate 를 먼저 호출해주세요', {
        market: MARKET,
      })
    }
    return cred
  }

  const adapter: MarketAdapter = {
    market: MARKET,
    credentialKind: 'hmac',

    // ───────────────────────────────────────────
    // authenticate — API 호출 없이 자격증명 검증 + 저장
    // ───────────────────────────────────────────
    async authenticate(input: AuthInput): Promise<StoredCredential> {
      if (input.kind !== 'hmac_key') {
        throw new MarketError(
          'validation',
          `쿠팡: hmac_key 입력 필요 (받은 kind: ${input.kind})`,
          { market: MARKET },
        )
      }

      // zod 검증 (min(1) 확인)
      const parsed = HmacKeyAuthInputSchema.safeParse(input)
      if (!parsed.success) {
        throw new MarketError(
          'validation',
          `쿠팡: 자격증명 형식 오류 — ${parsed.error.message}`,
          { market: MARKET, cause: parsed.error },
        )
      }

      const { accessKey, secretKey, vendorId } = parsed.data

      // 자격증명 인스턴스 저장
      cred = { accessKey, secretKey, vendorId }

      return StoredCredentialSchema.parse({
        kind: 'hmac',
        payload: { accessKey, secretKey, vendorId },
      })
    },

    // ───────────────────────────────────────────
    // fetchCategoryTree — depth 3까지 재귀
    // ───────────────────────────────────────────
    async fetchCategoryTree(): Promise<CategoryNode[]> {
      const { accessKey, secretKey } = getCredOrThrow()
      const correlationId = crypto.randomUUID()

      // 쿠팡 루트 카테고리 ID = 1
      const rootNode = await fetchCategoryNode(1, 1, accessKey, secretKey, correlationId)
      return [rootNode]
    },

    // ───────────────────────────────────────────
    // transformProduct — 순수 함수. Date.now / Math.random 금지.
    // ───────────────────────────────────────────
    transformProduct(product: Product, mapping: MarketMapping): MarketPayload {
      // 상품명 50자 제한 (Wing OpenAPI 요건)
      const truncatedName =
        product.name.length > PRODUCT_NAME_MAX_LENGTH
          ? product.name.slice(0, PRODUCT_NAME_MAX_LENGTH)
          : product.name

      // Wing OpenAPI 상품 생성 payload 구조 (부분 구현 — 베타 셀러 확인 후 보정)
      const raw = {
        sellerProductName: truncatedName,
        vendorId: cred?.vendorId ?? '',
        // 가격 (원 단위, 정수)
        salePrice: product.priceKrw,
        stockQuantity: product.stock,
        // 대표 이미지 URL 배열 (order 순 정렬)
        images: mapping.transformedImageUrls.map((url, idx) => ({
          imageOrder: idx,
          imageType: 'REPRESENTATION',
          cdnPath: url,
        })),
        // 카테고리 (Wing API: displayCategoryCode)
        displayCategoryCode: Number(mapping.categoryId),
        // 배송 정보
        shippingFee: product.shippingFeeKrw,
        // 브랜드 (optional)
        brand: product.brand ?? '',
        // 추가 매핑 필드 (마켓별 extra)
        ...mapping.extra,
      }

      return {
        market: MARKET,
        raw,
      }
    },

    // ───────────────────────────────────────────
    // createProduct — Wing OpenAPI POST
    // ───────────────────────────────────────────
    async createProduct(payload: MarketPayload): Promise<CreateProductResult> {
      const { accessKey, secretKey } = getCredOrThrow()
      const correlationId = crypto.randomUUID()

      if (payload.market !== MARKET) {
        throw new MarketError('validation', `잘못된 payload.market: ${payload.market}`, {
          market: MARKET,
        })
      }

      const path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products'
      const response = await coupangFetch({
        method: 'POST',
        path,
        accessKey,
        secretKey,
        body: payload.raw,
        correlationId,
      })

      const text = await response.text()

      if (!response.ok) {
        throw httpStatusToMarketError(response.status, text, correlationId)
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new MarketError('server', '쿠팡 상품 생성 응답 JSON 파싱 실패', {
          market: MARKET,
          status: response.status,
        })
      }

      const parsed = CoupangCreateProductResponseSchema.safeParse(json)
      if (!parsed.success) {
        throw new MarketError('server', '쿠팡 상품 생성 응답 스키마 불일치', {
          market: MARKET,
          cause: parsed.error,
        })
      }

      const data = parsed.data.data
      if (!data?.sellerProductId) {
        throw new MarketError(
          'server',
          `쿠팡 상품 생성 실패: ${parsed.data.message ?? '알 수 없는 오류'}`,
          {
            market: MARKET,
            marketErrorCode: parsed.data.code,
            ...(parsed.data.message !== undefined
              ? { marketErrorMessage: parsed.data.message }
              : {}),
          },
        )
      }

      const externalId = String(data.sellerProductId)
      const productUrl =
        data.productUrl ?? `https://www.coupang.com/vp/products/${externalId}`

      return CreateProductResultSchema.parse({
        market: MARKET,
        externalId,
        productUrl,
        status: 'succeeded',
        warnings: [],
      })
    },
  }

  return adapter
}

export const coupangRealAdapter: MarketAdapter = createCoupangRealAdapter()
